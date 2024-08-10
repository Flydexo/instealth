"use server";

import { RejectEmail } from "@repo/emails/reject";
import { PaymentEmail } from "@repo/emails/payment";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

export const sendRejectInvoice = async (uid: string, to: string, from: string, name: string) => {
    return await resend.emails.send({
        from: 'Instealth <instealth@nebulearn.xyz>',
        to: [to],
        subject: `${from} rejected your invoice: ${name}`,
        react: RejectEmail({ from, uid, name }),
    });
}

export const sendPaymentEmail = async (email: string, amount: number, uid: string, name: string, from: string) => {
    return await resend.emails.send({
        from: 'Instealth <instealth@nebulearn.xyz>',
        to: [email],
        subject: `Payment received for invoice: ${name}`,
        react: PaymentEmail({ amount, uid, name, from }),
    });
}