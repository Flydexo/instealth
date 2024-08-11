

import { Tailwind, Button, Html, Heading, Body, Container } from "@react-email/components";

interface EmailTemplateProps {
    from: string;
    name: string;
    uid: string;
    amount: number;
    env: string;
    stealth: string;
}

export const PaymentEmail: React.FC<Readonly<EmailTemplateProps>> = ({
    name,
    uid,
    from,
    amount,
    env,
    stealth
}) => (
    <Html>
        <Tailwind>
            <Body className='bg-white my-auto mx-auto font-sans px-2'>
                <Container className="border border-solid border-[#eaeaea] rounded my-[40px] mx-auto p-[20px] max-w-[465px] flex flex-col items-center justify-center">
                    <Heading className='text-black text-[24px] font-normal text-center p-0 my-[30px] mx-0' as="h2">{from} paid your invoice: {name} for {Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(amount)}</Heading>
                    <Button className="bg-[#000000] rounded text-white text-[12px] font-semibold no-underline text-center px-5 py-3" href={`${env === "development" ? "http://localhost:3000" : "https://instealth.vercel.app"}/payment#?uid=${uid}&stealth=${encodeURIComponent(stealth)}`}>Update invoice</Button>
                </Container>
            </Body>
        </Tailwind>
    </Html>
);

// InvoiceEmail.PreviewProps = {
//     invoice: {
//         email: "test@test.com",
//         date: "2021-01-01",
//         amount: 100,
//         status: "pending",
//         name: "Test User",
//         uid: "123",
//         file: "test.pdf"
//     },
//     fromAddress: "0x0000000000000000000000000000000000000000"
// };

export default PaymentEmail;
