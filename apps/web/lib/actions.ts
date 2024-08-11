"use server";

import { RejectEmail } from "@repo/emails/reject";
import { PaymentEmail } from "@repo/emails/payment";
import { ProofEmail } from "@repo/emails/proof";
import { Resend } from "resend";
import { Invoice } from "./stores";
import InvoiceEmail from "@repo/emails/invoice";

const resend = new Resend(process.env.RESEND_API_KEY);

export const sendRejectInvoice = async (uid: string, to: string, from: string, name: string) => {
    return await resend.emails.send({
        from: 'Instealth <instealth@nebulearn.xyz>',
        to: [to],
        subject: `${from} rejected your invoice: ${name}`,
        react: RejectEmail({ from, uid, name, env: process.env.NODE_ENV }),
    });
}

export const sendPaymentEmail = async (email: string, amount: number, uid: string, name: string, from: string, stealth: string) => {
    return await resend.emails.send({
        from: 'Instealth <instealth@nebulearn.xyz>',
        to: [email],
        subject: `Payment received for invoice: ${name}`,
        react: PaymentEmail({ amount, uid, name, from, env: process.env.NODE_ENV, stealth }),
    });
}

export const sendProofEmail = async (email: string, proof: string[], uid: string, taxAmount: string) => {
    return await resend.emails.send({
        from: 'Instealth <instealth@nebulearn.xyz>',
        to: [email],
        subject: `Tax proof for invoice: ${uid}`,
        react: ProofEmail({ proof, uid, env: process.env.NODE_ENV, taxAmount }),
    });
}

export const sendInvoiceEmail = async (invoice: Invoice, from: string, fromAddress: string) => {
    return await resend.emails.send({
        from: 'Instealth <instealth@nebulearn.xyz>',
        to: [invoice.email],
        subject: `New invoice from ${from}`,
        react: InvoiceEmail({ fromAddress: fromAddress, invoice: invoice, from: from, env: process.env.NODE_ENV }),
    });
}