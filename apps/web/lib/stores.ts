import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { OnchainInvoice } from './utils';

export enum InvoiceStatus {
    Sent = 'sent',
    Rejected = 'rejected',
    Paid = 'paid'
}


export interface Invoice {
    date: string;
    name: string;
    amount: string;
    email: string;
    status: InvoiceStatus;
    onchainInvoice: OnchainInvoice | undefined;
    file: string;
    uid: string;
    fromAddress: string | undefined;
}

interface InvoiceStore {
    sentInvoices: Invoice[];
    receivedInvoices: Invoice[];
    setSentInvoices: (invoices: Invoice[]) => void;
    setReceivedInvoices: (invoices: Invoice[]) => void;
    addSentInvoice: (invoice: Invoice) => void;
    addReceivedInvoice: (invoice: Invoice) => void;
    updateInvoice: (uid: string, updatedInvoice: Partial<Invoice>) => void;
}
export const useInvoiceStore = create<InvoiceStore>()(
    persist(
        (set) => ({
            sentInvoices: [],
            receivedInvoices: [],
            setSentInvoices: (invoices) => set({ sentInvoices: invoices }),
            setReceivedInvoices: (invoices) => set({ receivedInvoices: invoices }),
            addSentInvoice: (invoice) => set((state) => ({ sentInvoices: [...state.sentInvoices, invoice] })),
            addReceivedInvoice: (invoice) => set((state) => ({ receivedInvoices: [...state.receivedInvoices, invoice] })),
            updateInvoice: (uid, updatedInvoice: Partial<Invoice>) => set((state) => ({
                receivedInvoices: state.receivedInvoices.map(invoice => {
                    if (invoice.uid === uid) {
                        return { ...invoice, ...updatedInvoice }
                    } else { return invoice }
                }),
                sentInvoices: state.sentInvoices.map(invoice => {
                    if (invoice.uid === uid) {
                        return { ...invoice, ...updatedInvoice }
                    } else { return invoice }
                })
            })),
        }),
        {
            name: 'invoice-storage',
        }
    )
);