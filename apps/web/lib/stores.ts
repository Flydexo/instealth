import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { OnchainInvoice } from './utils';

export enum InvoiceStatus {
    Sent = 'sent',
    Received = 'received',
    Rejected = 'rejected',
    Paid = 'paid'
}


interface Invoice {
    date: string;
    name: string;
    amount: string;
    email: string;
    status: InvoiceStatus;
    onchainInvoice: OnchainInvoice;
    file: File;
}

interface InvoiceStore {
    sentInvoices: Invoice[];
    receivedInvoices: Invoice[];
    setSentInvoices: (invoices: Invoice[]) => void;
    setReceivedInvoices: (invoices: Invoice[]) => void;
    addSentInvoice: (invoice: Invoice) => void;
    addReceivedInvoice: (invoice: Invoice) => void;
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
        }),
        {
            name: 'invoice-storage',
        }
    )
);