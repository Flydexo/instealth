"use client";

import { InvoiceStatus, useInvoiceStore } from "@/lib/stores";
import { useEffect, useState } from "react";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { extractEmbeddedXML } from "@/lib/utils";
import { useUser, useSmartAccountClient } from "@alchemy/aa-alchemy/react";
import { encodeAbiParameters, encodeFunctionData, parseEther, zeroAddress } from "viem";
import { easAbi } from "@/lib/abis/eas";
import { StandardMerkleTree } from "@openzeppelin/merkle-tree";
import { createPortal } from "react-dom";

const invoiceSchema = z.object({
    name: z.string().optional(),
    email: z.string().email(),
    pdf: z.any().refine((value) => {
        console.log(value);
        return value instanceof FileList;
    }, { message: "Invalid file" }).refine((value: FileList) => value.length > 0, { message: "File is required" }).refine((value: FileList) => value.item(0)?.type === "application/pdf", { message: "Invalid file type" }),
});

export default function Invoices() {
    const { sentInvoices, receivedInvoices, setSentInvoices, setReceivedInvoices } = useInvoiceStore();
    const user = useUser();
    const { client } = useSmartAccountClient({ type: 'LightAccount' });
    const [activeTab, setActiveTab] = useState('sent');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [modalStatus, setModalStatus] = useState('');
    const [txHash, setTxHash] = useState('');

    const displayInvoices = activeTab === 'sent' ? sentInvoices : receivedInvoices;

    const { register, handleSubmit, setValue, reset } = useForm<z.infer<typeof invoiceSchema>>({
        resolver: zodResolver(invoiceSchema),
    });

    const onSubmit = async (data: z.infer<typeof invoiceSchema>) => {
        setIsModalOpen(true);
        setModalStatus('Extracting invoice data...');
        const invoice = await extractEmbeddedXML(await data.pdf[0]!.arrayBuffer());
        if (!invoice || !client) {
            setModalStatus('Error: Invalid invoice or client not available');
            return;
        }
        if (!data.name) {
            setValue('name', invoice.ID);
        }
        setModalStatus('Creating new invoice...');
        const newInvoice = {
            date: invoice.date.value.replace(/(\d{4})(\d{2})(\d{2})/, '$1-$2-$3'),
            name: data.name || invoice.ID,
            amount: invoice.tradeSettlement.duePayableAmount!,
            email: data.email,
            status: InvoiceStatus.Sent,
            onchainInvoice: invoice,
            file: data.pdf.item(0)!,
        };
        useInvoiceStore.getState().addSentInvoice(newInvoice);
        reset();
        setModalStatus('Preparing invoice data for blockchain...');
        const onchainInvoiceLeafs: string[][] = [
            ["ID", invoice.ID],
            ["date.value", invoice.date.value],
            ["date.format", invoice.date.format],
            ["typeCode", invoice.typeCode],
            ["issuerAssignedID", invoice.issuerAssignedID],
            ["buyerTradeParty.name", invoice.buyerTradeParty.name],
            ["buyerTradeParty.specifiedLegalOrganizationID.value", invoice.buyerTradeParty.specifiedLegalOrganizationID.value],
            ["buyerTradeParty.specifiedLegalOrganizationID.schemeID", invoice.buyerTradeParty.specifiedLegalOrganizationID.schemeID],
            ["sellerTradeParty.name", invoice.sellerTradeParty.name],
            ["sellerTradeParty.postalTradeAddress.countryID", invoice.sellerTradeParty.postalTradeAddress.countryID],
            ["sellerTradeParty.specifiedLegalOrganizationID.value", invoice.sellerTradeParty.specifiedLegalOrganizationID.value],
            ["sellerTradeParty.specifiedLegalOrganizationID.schemeID", invoice.sellerTradeParty.specifiedLegalOrganizationID.schemeID],
            ["sellerTradeParty.specifiedTaxRegistrationID.value", invoice.sellerTradeParty.specifiedTaxRegistrationID.value],
            ["sellerTradeParty.specifiedTaxRegistrationID.schemeID", invoice.sellerTradeParty.specifiedTaxRegistrationID.schemeID],
            ["tradeSettlement.invoiceCurrencyCode", invoice.tradeSettlement.invoiceCurrencyCode],
            ["tradeSettlement.duePayableAmount", invoice.tradeSettlement.duePayableAmount],
            ["tradeSettlement.taxBasisTotalAmount", invoice.tradeSettlement.taxBasisTotalAmount],
            ["tradeSettlement.taxTotalAmount.value", invoice.tradeSettlement.taxTotalAmount.value],
            ["tradeSettlement.taxTotalAmount.currencyID", invoice.tradeSettlement.taxTotalAmount.currencyID]
        ];
        const tree = StandardMerkleTree.of(onchainInvoiceLeafs, ["string", "string"]);
        setModalStatus('Sending transaction...');
        const uo = await client.sendUserOperation({
            uo: {
                target: easAbi.address,
                data: encodeFunctionData({
                    abi: easAbi.abi,
                    functionName: 'attest',
                    args: [
                        {
                            schema: '0x2bf052f39c4d907b3032aa7968663d1f49b99a6dd6fb8b23f5519c46567f846b',
                            data: {
                                recipient: zeroAddress,
                                expirationTime: 0n,
                                revocable: true,
                                refUID: '0x0',
                                data: encodeAbiParameters([{ type: 'bytes32' }], [tree.root as `0x${string}`]),
                                value: 0n
                            }
                        }
                    ]
                })
            }
        });
        setModalStatus('Waiting for transaction confirmation...');
        const hash = await client.waitForUserOperationTransaction(uo);
        setTxHash(hash);
        setModalStatus('Transaction confirmed!');
    }

    return <>
        {user && <main className="container mx-auto mt-8 px-4">
            <div className="mb-4">
                <ul className="flex border-b">
                    <li className="mr-1">
                        <a
                            className={`bg-white inline-block py-2 px-4 font-semibold ${activeTab === 'sent' ? 'text-blue-800' : 'text-blue-500 hover:text-blue-800'}`}
                            href="#"
                            onClick={() => setActiveTab('sent')}
                        >
                            Sent Invoices
                        </a>
                    </li>
                    <li className="mr-1">
                        <a
                            className={`bg-white inline-block py-2 px-4 font-semibold ${activeTab === 'received' ? 'text-blue-800' : 'text-blue-500 hover:text-blue-800'}`}
                            href="#"
                            onClick={() => setActiveTab('received')}
                        >
                            Received Invoices
                        </a>
                    </li>
                </ul>
            </div>

            <div className="bg-white shadow-md rounded px-8 pt-6 pb-8 mb-4">
                {activeTab === 'sent' && (
                    <form className="flex flex-wrap -mx-2" onSubmit={handleSubmit(onSubmit)}>
                        <div className="w-full sm:w-1/2 md:w-1/5 px-2 mb-4">
                            <input
                                type="text"
                                placeholder="Name"
                                className="w-full p-2 border rounded"
                                {...register('name')}
                            />
                        </div>
                        <div className="w-full sm:w-1/2 md:w-1/5 px-2 mb-4">
                            <input
                                type="email"
                                placeholder="Recipient Email"
                                className="w-full p-2 border rounded"
                                {...register('email')}
                            />
                        </div>
                        <div className="w-full sm:w-1/2 md:w-1/5 px-2 mb-4">
                            <input
                                type="file"
                                accept=".pdf"
                                className="w-full p-2 border rounded"
                                {...register('pdf')}
                            />
                        </div>
                        <div className="w-full sm:w-1/2 md:w-1/5 px-2 mb-4">
                            <button
                                type="submit"
                                className="w-full bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
                            >
                                Send
                            </button>
                        </div>
                    </form>
                )}
                <table className="w-full">
                    <thead>
                        <tr>
                            <th className="px-4 py-2">Date</th>
                            <th className="px-4 py-2">Name</th>
                            <th className="px-4 py-2">Amount</th>
                            <th className="px-4 py-2">Email</th>
                            <th className="px-4 py-2">PDF</th>
                            {activeTab === 'sent' && (
                                <th className="px-4 py-2">Status</th>
                            )}
                            {activeTab === 'received' && (
                                <th className="px-4 py-2">Actions</th>
                            )}
                        </tr>
                    </thead>
                    <tbody>
                        {displayInvoices.map((invoice, index) => (
                            <tr key={index}>
                                <td className="border px-4 py-2">{invoice.date}</td>
                                <td className="border px-4 py-2">{invoice.name}</td>
                                <td className="border px-4 py-2">{invoice.amount}</td>
                                <td className="border px-4 py-2">{invoice.email}</td>
                                <td className="border px-4 py-2">
                                    <a href={URL.createObjectURL(invoice.file)} download={invoice.file.name} className="text-blue-500 hover:text-blue-800">View PDF</a>
                                </td>
                                {activeTab === 'sent' && (
                                    <td className="border px-4 py-2">{invoice.status}</td>
                                )}
                                {activeTab === 'received' && (
                                    <td className="border px-4 py-2">
                                        <button
                                            className="bg-red-500 hover:bg-red-700 text-white font-bold py-1 px-2 rounded mr-2"
                                            onClick={() => {
                                                // Handle reject logic here
                                            }}
                                        >
                                            Reject
                                        </button>
                                        <button
                                            className="bg-green-500 hover:bg-green-700 text-white font-bold py-1 px-2 rounded"
                                            onClick={() => {
                                                // Handle pay logic here
                                            }}
                                        >
                                            Pay
                                        </button>
                                    </td>
                                )}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            {isModalOpen && createPortal(<div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full">
                <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
                    <div className="mt-3 text-center">
                        <h3 className="text-lg leading-6 font-medium text-gray-900">Transaction Status</h3>
                        <div className="mt-2 px-7 py-3">
                            <p className="text-sm text-gray-500">
                                {modalStatus}
                            </p>
                            {txHash && (
                                <p className="mt-2 text-sm text-gray-500">
                                    Transaction Hash: {txHash}
                                </p>
                            )}
                        </div>
                        {txHash && (
                            <div className="items-center px-4 py-3">
                                <button
                                    id="ok-btn"
                                    className="px-4 py-2 bg-blue-500 text-white text-base font-medium rounded-md w-full shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-300"
                                    onClick={() => {
                                        setIsModalOpen(false);
                                        setModalStatus('');
                                        setTxHash('');
                                    }}
                                >
                                    Close
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </div>, document.body)}
        </main >}
    </>
}