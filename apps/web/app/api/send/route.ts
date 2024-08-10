import { Resend } from 'resend';
import { InvoiceEmail } from '@repo/emails/invoice';

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { data, error } = await resend.emails.send({
            from: 'Instealth <instealth@nebulearn.xyz>',
            to: [body.invoice.email],
            subject: `New invoice from ${body.from}`,
            react: InvoiceEmail({ fromAddress: body.fromAddress, invoice: body.invoice, from: body.from, signature: body.signature }),
        });

        if (error) {
            return Response.json({ error }, { status: 500 });
        }

        return Response.json(data);
    } catch (error) {
        return Response.json({ error }, { status: 500 });
    }
}
