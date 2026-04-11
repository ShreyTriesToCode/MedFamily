import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import type { AccessGrant, AccessScope, AccessibleFamily, FamilyGroup, FamilyMember } from '@/lib/types';
import { handleSupabaseError, logError } from '@/utils/errorHandler';

interface CareWorkspaceState {
  accessibleFamilies: AccessibleFamily[];
  members: FamilyMember[];
  grants: AccessGrant[];
  loading: boolean;
  error: string | null;
}

function grantIncludesScope(grant: AccessGrant, requiredScope?: AccessScope | null): boolean {
  if (!requiredScope) {
    return true;
  }

  if (!grant.permission_scopes.length) {
    return true;
  }

  return grant.permission_scopes.includes(requiredScope);
}

function filterMembersByGrant(grant: AccessGrant, members: FamilyMember[]): FamilyMember[] {
  if (!grant.member_ids.length) {
    return members;
  }

  return members.filter((member) => grant.member_ids.includes(member.id));
}

export function useCareWorkspace(requiredScope?: AccessScope | null) {
  const { user, role, familyGroup } = useAuth();
  const [state, setState] = useState<CareWorkspaceState>({
    accessibleFamilies: [],
    members: [],
    grants: [],
    loading: true,
    error: null,
  });

  const refresh = useCallback(async () => {
    if (!user || !role) {
      setState({
        accessibleFamilies: [],
        members: [],
        grants: [],
        loading: false,
        error: null,
      });
      return;
    }

    setState((prev) => ({ ...prev, loading: true, error: null }));

    try {
      if (role === 'patient_admin' || role === 'family_member') {
        if (!familyGroup) {
          setState({
            accessibleFamilies: [],
            members: [],
            grants: [],
            loading: false,
            error: null,
          });
          return;
        }

        const { data: membersData, error: membersError } = await supabase
          .from('family_members')
          .select('*')
          .eq('group_id', familyGroup.id)
          .order('created_at', { ascending: true });

        if (membersError) {
          throw membersError;
        }

        setState({
          accessibleFamilies: [
            {
              group: familyGroup,
              members: membersData ?? [],
              grant: null,
            },
          ],
          members: membersData ?? [],
          grants: [],
          loading: false,
          error: null,
        });

        return;
      }

      if (role === 'chemist') {
        setState({
          accessibleFamilies: [],
          members: [],
          grants: [],
          loading: false,
          error: null,
        });
        return;
      }

      const grantResponse = await supabase
        .from('access_grants')
        .select('*')
        .eq('grantee_user_id', user.id)
        .eq('status', 'active');

      if (grantResponse.error) {
        throw grantResponse.error;
      }

      const now = new Date().toISOString();
      const grants = (grantResponse.data ?? []).filter(
        (grant) => (!grant.expires_at || grant.expires_at > now) && grantIncludesScope(grant, requiredScope)
      ) as AccessGrant[];

      if (!grants.length) {
        setState({
          accessibleFamilies: [],
          members: [],
          grants: [],
          loading: false,
          error: null,
        });
        return;
      }

      const groupIds = [...new Set(grants.map((grant) => grant.target_group_id))];

      const [{ data: groupsData, error: groupsError }, { data: membersData, error: membersError }] =
        await Promise.all([
          supabase.from('family_groups').select('*').in('id', groupIds),
          supabase.from('family_members').select('*').in('group_id', groupIds).order('created_at', { ascending: true }),
        ]);

      if (groupsError) {
        throw groupsError;
      }

      if (membersError) {
        throw membersError;
      }

      const groupsMap = new Map<string, FamilyGroup>((groupsData ?? []).map((group) => [group.id, group as FamilyGroup]));
      const membersByGroup = new Map<string, FamilyMember[]>();

      for (const member of (membersData ?? []) as FamilyMember[]) {
        const bucket = membersByGroup.get(member.group_id) ?? [];
        bucket.push(member);
        membersByGroup.set(member.group_id, bucket);
      }

      const accessibleFamilies = grants
        .map((grant) => {
          const group = groupsMap.get(grant.target_group_id);
          if (!group) {
            return null;
          }

          const groupMembers = membersByGroup.get(grant.target_group_id) ?? [];
          return {
            group,
            members: filterMembersByGrant(grant, groupMembers),
            grant,
          };
        })
        .filter((family): family is NonNullable<typeof family> => family !== null);

      const flattenedMembers = accessibleFamilies.flatMap((family) => family.members);

      setState({
        accessibleFamilies: accessibleFamilies as AccessibleFamily[],
        members: flattenedMembers,
        grants,
        loading: false,
        error: null,
      });
    } catch (err) {
      logError(err, 'useCareWorkspace.refresh');
      setState({
        accessibleFamilies: [],
        members: [],
        grants: [],
        loading: false,
        error: handleSupabaseError(err as { message: string; code?: string }),
      });
    }
  }, [familyGroup, requiredScope, role, user]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return {
    ...state,
    refresh,
  };
}
