"use client";

import { Invoice, InvoiceStatus, useInvoiceStore } from "@/lib/stores";
import { useEffect, useState } from "react";
import { set, z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { base64ToFile, EURC, extractEmbeddedXML, fileToBase64 } from "@/lib/utils";
import { useUser, useSmartAccountClient, useSigner, useExportAccount } from "@alchemy/aa-alchemy/react";
import { domainSeparator, encodeAbiParameters, encodeFunctionData, erc20Abi, hexToSignature, keccak256, parseEther, toFunctionSelector, toHex, zeroAddress } from "viem";
import { easAbi } from "@/lib/abis/eas";
import { StandardMerkleTree } from "@openzeppelin/merkle-tree";
import { createPortal } from "react-dom";
import { gasManagerConfig } from "@/lib/config";
import * as React from 'react';
import { sendPaymentEmail, sendRejectInvoice } from "@/lib/actions";
import Link from "next/link";
import { generateKeysFromSignature, generateStealthAddress, generateStealthMetaAddressFromKeys, generateStealthMetaAddressFromSignature } from "@scopelift/stealth-address-sdk";
import { stealthAbi } from "@/lib/abis/stealth";

const invoiceSchema = z.object({
    name: z.string().optional(),
    email: z.string().email(),
    pdf: z.any().refine((value) => {
        return value instanceof FileList;
    }, { message: "Invalid file" }).refine((value: FileList) => value.length > 0, { message: "File is required" }).refine((value: FileList) => value.item(0)?.type === "application/pdf", { message: "Invalid file type" }),
});
export const getFile = async (invoices: Invoice[]): Promise<(Omit<Invoice, 'file'> & { file: File })[]> => {
    return Promise.all(invoices.map(async (invoice) => {
        return {
            ...invoice,
            file: await base64ToFile(invoice.file, `${invoice.name}.pdf`)
        } as Omit<Invoice, 'file'> & { file: File };
    }));
}


export const getUID = async (hash: string): Promise<string | undefined> => {
    for (let i = 0; i < 10; i++) {
        try {
            const logs = await (await fetch(`https://base-sepolia.blockscout.com/api/v2/transactions/${hash}/logs`)).json();
            return logs.items.find((item: any) => item.decoded.method_call === "Attested(address indexed recipient, address indexed attester, bytes32 uid, bytes32 indexed schemaUID)").decoded.parameters[2].value;
        } catch (e) {
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
    }
}

export default function Invoices() {
    const { sentInvoices, receivedInvoices, setSentInvoices, setReceivedInvoices } = useInvoiceStore();
    const user = useUser();
    const { client } = useSmartAccountClient({ type: 'LightAccount', gasManagerConfig });
    const [activeTab, setActiveTab] = useState('sent');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [modalStatus, setModalStatus] = useState('');
    const [txHash, setTxHash] = useState<[string, string]>(['', '']);
    const [displayInvoices, setDisplayInvoices] = useState<(Omit<Invoice, 'file'> & { file: File })[]>([]);
    const signer = useSigner();

    useEffect(() => {
        getFile(activeTab === 'sent' ? sentInvoices : receivedInvoices).then(setDisplayInvoices);
    }, [activeTab, sentInvoices, receivedInvoices]);

    const { register, handleSubmit, setValue, reset } = useForm<z.infer<typeof invoiceSchema>>({
        resolver: zodResolver(invoiceSchema),
    });

    const onSubmit = async (data: z.infer<typeof invoiceSchema>) => {
        setIsModalOpen(true);
        setModalStatus('Extracting invoice data...');
        const invoice = await extractEmbeddedXML(await data.pdf[0]!.arrayBuffer());
        if (!invoice || !client || !signer) {
            setModalStatus('Error: Invalid invoice or client not available');
            return;
        }
        if (!data.name) {
            setValue('name', invoice.ID);
        }
        setModalStatus('Creating new invoice...');
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
                                refUID: '0x0000000000000000000000000000000000000000000000000000000000000000',
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
        const uid = await getUID(hash);
        if (!uid) return setModalStatus('There was an error with the transaction');
        setModalStatus('Transaction confirmed!');
        const newInvoice = {
            date: invoice.date.value.replace(/(\d{4})(\d{2})(\d{2})/, '$1-$2-$3'),
            name: data.name || invoice.ID,
            amount: invoice.tradeSettlement.duePayableAmount!,
            email: data.email,
            status: InvoiceStatus.Sent,
            onchainInvoice: invoice,
            file: await fileToBase64(data.pdf.item(0)!),
            uid,
            fromAddress: undefined
        };
        useInvoiceStore.getState().addSentInvoice(newInvoice);
        reset();
        const keys = generateKeysFromSignature(await signer!.signMessage(`Generate stealth address for chain base sepolia on instealth`));
        const stealthMeta = `st:basesep:${generateStealthMetaAddressFromKeys(keys)}`;

        await fetch('/api/send', {
            method: 'POST',
            body: JSON.stringify({ from: user!.email, invoice: newInvoice, fromAddress: stealthMeta }),
        });
        setModalStatus('Email sent!');
        setTxHash([hash, uid]);
    }

    return <div>
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
                                    <td className="border px-4 py-2">{invoice.status} {invoice.status === InvoiceStatus.Paid && <a href={`https://base-sepolia.blockscout.com/address/${invoice.fromAddress}`} target="_blank" className="text-blue-500 hover:text-blue-800">View receipt</a>}</td>
                                )}
                                {activeTab === 'received' && (
                                    <td className="border px-4 py-2">
                                        <button className="bg-red-500 hover:bg-red-700 text-white font-bold py-1 px-2 rounded" onClick={async () => {
                                            await sendRejectInvoice(invoice.uid, invoice.email, user!.email as string, invoice.name);
                                            setIsModalOpen(true);
                                            setModalStatus(`Email sent to ${invoice.email}`);
                                        }}>
                                            Reject
                                        </button>
                                        <button
                                            className="bg-green-500 hover:bg-green-700 text-white font-bold py-1 px-2 rounded"
                                            onClick={async () => {
                                                if (!client) return;
                                                setIsModalOpen(true);
                                                setModalStatus(`Sending ${invoice.amount}€ to ${invoice.email}`);
                                                const { stealthAddress, ephemeralPublicKey, viewTag } = generateStealthAddress({ stealthMetaAddressURI: invoice.fromAddress! })
                                                const uo = await client.sendUserOperation({
                                                    uo: {
                                                        target: EURC,
                                                        data: encodeFunctionData({
                                                            abi: erc20Abi,
                                                            functionName: 'transfer',
                                                            args: [stealthAddress, parseEther(invoice.amount)]
                                                        })
                                                    }
                                                });
                                                const hash = await client.waitForUserOperationTransaction(uo);
                                                setModalStatus(`Announcing payment to ${invoice.email}`);
                                                const announceUO = await client.sendUserOperation({
                                                    uo: {
                                                        target: stealthAbi.address,
                                                        data: encodeFunctionData({
                                                            abi: stealthAbi.abi,
                                                            functionName: 'announce',
                                                            args: [1n, stealthAddress, ephemeralPublicKey, `${viewTag}${toFunctionSelector('function transfer(address,uint256) returns (bool)').slice(2)}${EURC.slice(2)}${toHex(parseEther(invoice.amount)).slice(2)}`]
                                                        })
                                                    }
                                                });
                                                await client.waitForUserOperationTransaction(announceUO);
                                                setModalStatus(`Sending email!`);
                                                await sendPaymentEmail(invoice.email, Number(invoice.amount), invoice.uid, invoice.name, user!.email as string, stealthAddress);
                                                setModalStatus(`Email sent! to ${invoice.email}`);
                                                setTxHash([hash, '']);
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

        </main >}
        {isModalOpen && createPortal(<div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full">
            <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
                <div className="mt-3 text-center">
                    <h3 className="text-lg leading-6 font-medium text-gray-900">Transaction Status</h3>
                    <div className="mt-2 px-7 py-3 flex flex-col gap-2">
                        <p className="text-sm text-gray-500">
                            {modalStatus}
                        </p>
                        {txHash[0] && (
                            <a href={`https://base-sepolia.blockscout.com/tx/${txHash[0]}`} target="_blank" className="text-blue-500 hover:text-blue-800">See transaction</a>
                        )}
                        {txHash[1] && txHash[1].length > 0 && (
                            <a href={`https://base-sepolia.easscan.org/attestation/view/${txHash[1]}`} target="_blank" className="text-blue-500 hover:text-blue-800">See attestation</a>
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
                                    setTxHash(['', '']);
                                }}
                            >
                                Close
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>, document.body)}
    </div>
}