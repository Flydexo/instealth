
import { Tailwind, Button, Html, Heading, Body, Container } from "@react-email/components";

interface EmailTemplateProps {
    from: string;
    name: string;
    uid: string;
}

export const RejectEmail: React.FC<Readonly<EmailTemplateProps>> = ({
    name,
    uid,
    from,
}) => (
    <Html>
        <Tailwind>
            <Body className='bg-white my-auto mx-auto font-sans px-2'>
                <Container className="border border-solid border-[#eaeaea] rounded my-[40px] mx-auto p-[20px] max-w-[465px] flex flex-col items-center justify-center">
                    <Heading className='text-black text-[24px] font-normal text-center p-0 my-[30px] mx-0' as="h2">{from} rejected your invoice {name}</Heading>
                    <Button className="bg-[#000000] rounded text-white text-[12px] font-semibold no-underline text-center px-5 py-3" href={`http://localhost:3000/reject#?uid=${uid}`}>Update invoice</Button>
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

export default RejectEmail;
