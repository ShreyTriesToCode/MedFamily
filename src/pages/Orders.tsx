import { useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import { PackagePlus, Truck } from 'lucide-react';
import Layout from '@/components/layout/Layout';
import PageHeader from '@/components/app/PageHeader';
import SearchBar from '@/components/app/SearchBar';
import SectionHeader from '@/components/app/SectionHeader';
import ChatPanel from '@/components/orders/ChatPanel';
import OrderStatusStepper from '@/components/orders/OrderStatusStepper';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import EmptyState from '@/components/ui/EmptyState';
import FileUpload from '@/components/ui/FileUpload';
import Input from '@/components/ui/Input';
import Modal from '@/components/ui/Modal';
import Select from '@/components/ui/Select';
import { useAuth } from '@/context/AuthContext';
import { useCareWorkspace } from '@/hooks/useCareWorkspace';
import { useOrderChat } from '@/hooks/useOrderChat';
import { useOrders } from '@/hooks/useOrders';
import { usePrescriptions } from '@/hooks/usePrescriptions';
import { ORDER_STATUS_OPTIONS } from '@/lib/constants';
import type { MedicineOrderFormInputs, MedicineOrderItemInput, OrderStatus } from '@/lib/types';
import { showErrorToast, showSuccessToast } from '@/utils/errorHandler';

function emptyOrderItem(): MedicineOrderItemInput {
  return {
    medicine_name: '',
    dosage: '',
    quantity: '',
    instructions: '',
    source: 'manual',
  };
}

export default function Orders() {
  const { user, role, familyGroup } = useAuth();
  const { accessibleFamilies, members } = useCareWorkspace('medicine_ordering');
  const { prescriptions } = usePrescriptions();
  const {
    orders,
    activeOrders,
    pastOrders,
    itemsByOrderId,
    historyByOrderId,
    loading,
    placing,
    fetchOrders,
    placeOrder,
    updateOrderStatus,
  } = useOrders();

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | OrderStatus>('all');
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [orderForm, setOrderForm] = useState<MedicineOrderFormInputs>({
    family_group_id: familyGroup?.id ?? accessibleFamilies[0]?.group.id ?? '',
    patient_member_id: '',
    receiver_name: '',
    receiver_phone: '',
    delivery_address: '',
    location_text: '',
    map_link: '',
    notes: '',
    source_prescription_id: '',
    uploaded_prescription: null,
    items: [emptyOrderItem()],
    placed_for_name: '',
    placed_for_phone: '',
  });

  const selectedOrder = useMemo(
    () => orders.find((order) => order.id === selectedOrderId) ?? orders[0] ?? null,
    [orders, selectedOrderId]
  );

  const { messages, sending, sendMessage } = useOrderChat(selectedOrder?.id ?? null);

  useEffect(() => {
    void fetchOrders({
      search,
      status: statusFilter,
    });
  }, [fetchOrders, search, statusFilter]);

  useEffect(() => {
    if (!selectedOrderId && orders.length) {
      setSelectedOrderId(orders[0].id);
    }
  }, [orders, selectedOrderId]);

  const familyOptions = useMemo(
    () => accessibleFamilies.map((family) => ({ label: `${family.group.group_name} (${family.group.share_code})`, value: family.group.id })),
    [accessibleFamilies]
  );

  const memberOptions = useMemo(
    () => members.map((member) => ({ label: member.name, value: member.id })),
    [members]
  );

  const prescriptionOptions = useMemo(
    () =>
      prescriptions.map((prescription) => ({
        label: `${prescription.member_name} · ${prescription.doctor_name || 'Prescription'} · ${prescription.prescription_date}`,
        value: prescription.id,
      })),
    [prescriptions]
  );

  const canCreateOrder = role === 'patient_admin' || role === 'caretaker';
  const isChemist = role === 'chemist';

  const orderStatusOptions = [{ label: 'All statuses', value: 'all' }, ...ORDER_STATUS_OPTIONS.map((option) => ({
    label: option.label,
    value: option.value,
  }))];

  const setOrderItem = (index: number, next: Partial<MedicineOrderItemInput>) => {
    setOrderForm((prev) => ({
      ...prev,
      items: prev.items.map((item, currentIndex) => (currentIndex === index ? { ...item, ...next } : item)),
    }));
  };

  const handleCreateOrder = async () => {
    if (!orderForm.family_group_id || !orderForm.receiver_name || !orderForm.delivery_address) {
      showErrorToast('Choose the family, receiver, and delivery address.');
      return;
    }

    const cleanItems = orderForm.items.filter((item) => item.medicine_name.trim());
    if (!cleanItems.length) {
      showErrorToast('Add at least one medicine item.');
      return;
    }

    const result = await placeOrder({
      ...orderForm,
      items: cleanItems,
    });

    if (result.error) {
      showErrorToast(result.error);
      return;
    }

    setShowCreateModal(false);
    setOrderForm({
      family_group_id: familyGroup?.id ?? accessibleFamilies[0]?.group.id ?? '',
      patient_member_id: '',
      receiver_name: '',
      receiver_phone: '',
      delivery_address: '',
      location_text: '',
      map_link: '',
      notes: '',
      source_prescription_id: '',
      uploaded_prescription: null,
      items: [emptyOrderItem()],
      placed_for_name: '',
      placed_for_phone: '',
    });
    showSuccessToast('Medicine order placed successfully.');
  };

  const handleStatusUpdate = async (status: OrderStatus, note?: string) => {
    if (!selectedOrder) {
      return;
    }

    const result = await updateOrderStatus(selectedOrder.id, status, note);
    if (result.error) {
      showErrorToast(result.error);
      return;
    }

    showSuccessToast(`Order marked as ${status.replaceAll('_', ' ')}.`);
  };

  const renderChemistActions = () => {
    if (!selectedOrder || !isChemist) {
      return null;
    }

    const actionMap: Record<OrderStatus, { label: string; nextStatus?: OrderStatus; altStatus?: OrderStatus }> = {
      placed: { label: 'Claim and accept', nextStatus: 'accepted', altStatus: 'rejected' },
      awaiting_chemist_approval: { label: 'Accept order', nextStatus: 'accepted', altStatus: 'rejected' },
      accepted: { label: 'Start preparing', nextStatus: 'preparing' },
      preparing: { label: 'Mark packed', nextStatus: 'packed' },
      packed: { label: 'Out for delivery', nextStatus: 'out_for_delivery' },
      out_for_delivery: { label: 'Mark delivered', nextStatus: 'delivered' },
      delivered: { label: 'Delivered' },
      cancelled: { label: 'Cancelled' },
      rejected: { label: 'Rejected' },
    };

    const action = actionMap[selectedOrder.status];
    if (!action.nextStatus) {
      return null;
    }

    return (
      <div className="flex flex-wrap gap-2">
        <Button icon={<Truck className="h-4 w-4" />} onClick={() => handleStatusUpdate(action.nextStatus!)}>
          {action.label}
        </Button>
        {action.altStatus ? (
          <Button variant="danger" onClick={() => handleStatusUpdate(action.altStatus!)}>
            Reject
          </Button>
        ) : null}
      </div>
    );
  };

  return (
    <Layout pageTitle="Orders">
      <div className="space-y-6">
        <PageHeader
          eyebrow="Medicine ordering"
          title={isChemist ? 'Chemist fulfilment desk' : 'Medicine orders'}
          description={
            isChemist
              ? 'Claim new requests, keep fulfilment moving, and update patients with clean tracking milestones.'
              : 'Place medicine orders from a patient context, add delivery details, and track fulfilment from approval to delivery.'
          }
          showBackButton
          stats={
            isChemist
              ? [
                  { label: 'Queue', value: activeOrders.length, helper: 'Orders currently needing action or fulfilment.', tone: 'brand' },
                  { label: 'Claimed', value: orders.filter((order) => order.chemist_id === user?.id).length, helper: 'Requests already assigned to you.', tone: 'accent' },
                  { label: 'History', value: pastOrders.length, helper: 'Delivered, rejected, or cancelled orders retained.', tone: 'neutral' },
                ]
              : [
                  { label: 'Active orders', value: activeOrders.length, helper: 'Requests still moving through fulfilment.', tone: 'brand' },
                  { label: 'Delivered', value: pastOrders.filter((order) => order.status === 'delivered').length, helper: 'Completed deliveries saved in history.', tone: 'accent' },
                  { label: 'Patients covered', value: members.length, helper: 'Members available for medicine ordering.', tone: 'neutral' },
                ]
          }
          highlights={[
            'Per-order chat and tracking stay attached to the same workflow',
            'Orders can be created from a patient or prescription context',
            isChemist ? 'Use status updates to keep families informed in real time' : 'Delivery details and notes travel with the chemist order',
          ]}
          actions={
            canCreateOrder ? (
              <Button icon={<PackagePlus className="h-4 w-4" />} onClick={() => setShowCreateModal(true)}>
                Create order
              </Button>
            ) : undefined
          }
        />

        <SectionHeader
          eyebrow="Order desk"
          title="Search, filter, and work active orders"
          description="Keep the queue focused, then move into the selected order for tracking, delivery detail review, and chat."
        />
        <Card className="rounded-[30px]">
          <div className="grid gap-3 lg:grid-cols-[1.2fr_0.8fr]">
            <SearchBar value={search} onChange={setSearch} placeholder="Search by order ID or receiver" />
            <Select
              options={orderStatusOptions}
              value={statusFilter}
              onChange={(event) => setStatusFilter((event.target.value || 'all') as 'all' | OrderStatus)}
            />
          </div>
        </Card>

        {loading ? (
          <Card className="rounded-[30px]">
            <div className="py-6">
              <p className="text-sm text-text-secondary">Loading orders...</p>
            </div>
          </Card>
        ) : orders.length ? (
          <>
            <SectionHeader
              eyebrow="Fulfilment workspace"
              title="Order list and live tracking"
              description="Pick an order from the left, then use the detail panel to progress statuses, review attached items, and message the other side."
            />
            <div className="grid gap-4 xl:grid-cols-[0.92fr_1.08fr]">
            <Card title="Order list" className="rounded-[30px]">
              <div className="space-y-3">
                {orders.map((order) => (
                  <button
                    key={order.id}
                  type="button"
                  className={`w-full rounded-[24px] border p-4 text-left transition ${
                    selectedOrder?.id === order.id
                        ? 'theme-active-surface border-primary-300'
                        : 'theme-surface-soft border-transparent hover:border-border'
                    }`}
                    onClick={() => setSelectedOrderId(order.id)}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-bold text-text-primary">{order.order_number}</p>
                        <p className="mt-1 text-xs text-text-secondary">
                          {order.receiver_name} · {order.placed_for_name}
                        </p>
                      </div>
                      <div className="theme-chip rounded-full px-3 py-1.5 text-[11px] font-semibold">
                        {order.status.replaceAll('_', ' ')}
                      </div>
                    </div>
                    <p className="mt-2 text-xs text-text-secondary">
                      {format(new Date(order.created_at), 'dd MMM yyyy, hh:mm a')}
                    </p>
                  </button>
                ))}
              </div>
            </Card>

            {selectedOrder ? (
              <div className="space-y-4">
                <Card className="rounded-[30px]">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <p className="text-sm font-semibold text-text-secondary">Selected order</p>
                      <h2 className="mt-1 text-2xl font-bold text-text-primary">{selectedOrder.order_number}</h2>
                      <p className="mt-2 text-sm text-text-secondary">
                        Receiver: {selectedOrder.receiver_name}
                        {selectedOrder.receiver_phone ? ` · ${selectedOrder.receiver_phone}` : ''}
                      </p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <span className="theme-chip rounded-full px-3 py-1.5 text-[11px] font-semibold">
                          {selectedOrder.status.replaceAll('_', ' ')}
                        </span>
                        <span className="theme-chip rounded-full px-3 py-1.5 text-[11px] font-semibold">
                          {(itemsByOrderId[selectedOrder.id] ?? []).length} item{(itemsByOrderId[selectedOrder.id] ?? []).length !== 1 ? 's' : ''}
                        </span>
                        <span className="theme-chip rounded-full px-3 py-1.5 text-[11px] font-semibold">
                          {format(new Date(selectedOrder.created_at), 'dd MMM yyyy')}
                        </span>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {renderChemistActions()}
                      {!isChemist && ['placed', 'awaiting_chemist_approval', 'accepted'].includes(selectedOrder.status) ? (
                        <Button variant="danger" onClick={() => handleStatusUpdate('cancelled')}>
                          Cancel order
                        </Button>
                      ) : null}
                    </div>
                  </div>

                  <div className="mt-4 grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
                    <div className="rounded-[24px] bg-background-strong p-4">
                      <p className="text-sm font-semibold text-text-primary">Delivery details</p>
                      <p className="mt-2 text-sm text-text-secondary">{selectedOrder.delivery_address}</p>
                      {selectedOrder.location_text ? <p className="mt-2 text-xs text-text-secondary">{selectedOrder.location_text}</p> : null}
                      {selectedOrder.notes ? (
                        <div className="theme-surface-soft mt-3 rounded-[18px] px-3 py-2 text-xs text-text-secondary">
                          Note: {selectedOrder.notes}
                        </div>
                      ) : null}
                      <div className="mt-4 space-y-2">
                        {(itemsByOrderId[selectedOrder.id] ?? []).map((item) => (
                          <div key={item.id} className="theme-surface-soft rounded-[18px] px-3 py-3">
                            <p className="text-sm font-semibold text-text-primary">{item.medicine_name}</p>
                            <p className="mt-1 text-xs text-text-secondary">
                              {item.dosage || 'Dosage not provided'}
                              {item.quantity ? ` · ${item.quantity}` : ''}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>

                    <Card title="Tracking timeline" className="rounded-[24px] border border-transparent bg-transparent shadow-none">
                      <OrderStatusStepper
                        currentStatus={selectedOrder.status}
                        history={historyByOrderId[selectedOrder.id] ?? []}
                      />
                    </Card>
                  </div>
                </Card>

                <ChatPanel
                  messages={messages}
                  sending={sending}
                  currentUserId={user?.id}
                  onSend={async (message) => {
                    const result = await sendMessage(message);
                    if (result.error) {
                      showErrorToast(result.error);
                      return;
                    }
                    showSuccessToast('Message sent.');
                  }}
                />
              </div>
            ) : null}
            </div>
          </>
        ) : (
          <EmptyState
            title="No medicine orders yet"
            description={
              isChemist
                ? 'Families and caretakers will appear here as soon as they place new requests.'
                : 'Create your first medicine order from a patient context to start tracking fulfilment.'
            }
            actionLabel={canCreateOrder ? 'Create order' : undefined}
            onAction={canCreateOrder ? () => setShowCreateModal(true) : undefined}
          />
        )}
      </div>

      <Modal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title="Create medicine order"
        description="Start from a patient and optionally link an existing prescription or attach a new one."
        size="lg"
        footer={
          <div className="flex w-full justify-end gap-2">
            <Button variant="ghost" onClick={() => setShowCreateModal(false)}>
              Cancel
            </Button>
            <Button loading={placing} onClick={handleCreateOrder}>
              Place order
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Select
              label="Family"
              options={familyOptions}
              value={orderForm.family_group_id}
              onChange={(event) => setOrderForm((prev) => ({ ...prev, family_group_id: event.target.value }))}
            />
            <Select
              label="Patient"
              options={memberOptions}
              value={orderForm.patient_member_id}
              onChange={(event) => setOrderForm((prev) => ({ ...prev, patient_member_id: event.target.value }))}
              placeholder="Optional"
            />
            <Input
              label="Placed for"
              value={orderForm.placed_for_name}
              onChange={(event) => setOrderForm((prev) => ({ ...prev, placed_for_name: event.target.value }))}
              placeholder="Patient name"
            />
            <Input
              label="Patient contact"
              value={orderForm.placed_for_phone}
              onChange={(event) => setOrderForm((prev) => ({ ...prev, placed_for_phone: event.target.value }))}
            />
            <Input
              label="Receiver name"
              value={orderForm.receiver_name}
              onChange={(event) => setOrderForm((prev) => ({ ...prev, receiver_name: event.target.value }))}
            />
            <Input
              label="Receiver phone"
              value={orderForm.receiver_phone}
              onChange={(event) => setOrderForm((prev) => ({ ...prev, receiver_phone: event.target.value }))}
            />
          </div>

          <Input
            label="Delivery address"
            multiline
            value={orderForm.delivery_address}
            onChange={(event) => setOrderForm((prev) => ({ ...prev, delivery_address: event.target.value }))}
          />

          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              label="Location note"
              value={orderForm.location_text}
              onChange={(event) => setOrderForm((prev) => ({ ...prev, location_text: event.target.value }))}
              placeholder="Landmark, floor, or locality"
            />
            <Input
              label="Map link"
              value={orderForm.map_link}
              onChange={(event) => setOrderForm((prev) => ({ ...prev, map_link: event.target.value }))}
              placeholder="Optional map URL"
            />
          </div>

          <Select
            label="Use existing prescription"
            options={prescriptionOptions}
            value={orderForm.source_prescription_id}
            onChange={(event) => setOrderForm((prev) => ({ ...prev, source_prescription_id: event.target.value }))}
            placeholder="Not linked to an existing prescription"
          />
          <FileUpload
            label="Attach a new prescription instead"
            onFileSelect={(files) => setOrderForm((prev) => ({ ...prev, uploaded_prescription: files[0] ?? null }))}
          />

          <Input
            label="Note for chemist"
            multiline
            value={orderForm.notes}
            onChange={(event) => setOrderForm((prev) => ({ ...prev, notes: event.target.value }))}
            placeholder="Add stock notes, substitute preferences, or delivery instructions."
          />

          <Card title="Medicines" className="rounded-[28px]">
            <div className="space-y-4">
              {orderForm.items.map((item, index) => (
                <div key={`order-item-${index}`} className="rounded-[24px] bg-background-strong p-4">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Input
                      label="Medicine name"
                      value={item.medicine_name}
                      onChange={(event) => setOrderItem(index, { medicine_name: event.target.value })}
                    />
                    <Input
                      label="Dosage"
                      value={item.dosage}
                      onChange={(event) => setOrderItem(index, { dosage: event.target.value })}
                    />
                    <Input
                      label="Quantity"
                      value={item.quantity}
                      onChange={(event) => setOrderItem(index, { quantity: event.target.value })}
                    />
                    <Input
                      label="Instructions"
                      value={item.instructions}
                      onChange={(event) => setOrderItem(index, { instructions: event.target.value })}
                    />
                  </div>
                </div>
              ))}
              <Button variant="outline" size="sm" onClick={() => setOrderForm((prev) => ({ ...prev, items: [...prev.items, emptyOrderItem()] }))}>
                Add medicine
              </Button>
            </div>
          </Card>
        </div>
      </Modal>
    </Layout>
  );
}
