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
import { sendInvoiceEmail, sendPaymentEmail, sendProofEmail, sendRejectInvoice } from "@/lib/actions";
import { generateKeysFromSignature, generateStealthAddress, generateStealthMetaAddressFromKeys } from "@scopelift/stealth-address-sdk";
import { stealthAbi } from "@/lib/abis/stealth";
import { Button } from "./ui/button";
import { Loader2, Mail } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
import { DataTable } from "./data-table";
import { receivedColumns, sentColumns } from "./columns";
import { Input } from "./ui/input";
import { toast } from "./ui/use-toast";
import Link from "next/link";

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
    const [isLoading, setIsLoading] = useState(false);
    const { client } = useSmartAccountClient({ type: 'LightAccount', gasManagerConfig });
    const signer = useSigner();
    const [displayedSentInvoices, setDisplayedSentInvoices] = useState<(Omit<Invoice, 'file'> & { file: File })[]>([]);
    const [displayedReceivedInvoices, setDisplayedReceivedInvoices] = useState<(Omit<Invoice, 'file'> & { file: File })[]>([]);

    useEffect(() => {
        getFile(sentInvoices).then(setDisplayedSentInvoices);
        getFile(receivedInvoices).then(setDisplayedReceivedInvoices);
    }, [sentInvoices, receivedInvoices]);

    const { register, handleSubmit, setValue, reset } = useForm<z.infer<typeof invoiceSchema>>({
        resolver: zodResolver(invoiceSchema),
    });

    const onSubmit = async (data: z.infer<typeof invoiceSchema>) => {
        setIsLoading(true);
        toast({ title: "Extracting invoice data", description: "Extracting invoice data..." });
        const invoice = await extractEmbeddedXML(await data.pdf[0]!.arrayBuffer());
        if (!invoice || !client || !signer) {
            toast({ title: "Error", description: "Invalid invoice or client not available" });
            setIsLoading(false);
            return;
        }
        if (!data.name) {
            setValue('name', invoice.ID);
        }
        toast({ title: "Creating new invoice", description: "Preparing invoice data for blockchain..." });
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
        toast({ title: "Sending transaction", description: "Sending transaction..." });
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
        toast({ title: "Waiting for transaction confirmation", description: "Waiting for transaction confirmation..." });
        const hash = await client.waitForUserOperationTransaction(uo);
        const uid = await getUID(hash);
        if (!uid) {
            toast({ title: "Transaction confirmed", description: "There was an error with the transaction" });
            setIsLoading(false);
            return;
        }
        toast({ title: "Transaction confirmed", description: <Link href={`https://base-sepolia.blockscout.com/tx/${hash}`} target="_blank" className="text-blue-500 hover:text-blue-800">View receipt</Link> });
        const newInvoice = {
            date: invoice.date.value.replace(/(\d{4})(\d{2})(\d{2})/, '$1-$2-$3'),
            name: data.name || invoice.ID,
            amount: invoice.tradeSettlement.duePayableAmount!,
            email: data.email,
            status: InvoiceStatus.Sent,
            onchainInvoice: invoice,
            file: "",
            uid,
            fromAddress: undefined
        };
        useInvoiceStore.getState().addSentInvoice(newInvoice);
        reset();
        const keys = generateKeysFromSignature(await signer!.signMessage(`Generate stealth address for chain base sepolia on instealth`));
        const stealthMeta = `st:basesep:${generateStealthMetaAddressFromKeys(keys)}`;
        console.log(user!.email, stealthMeta)
        await sendInvoiceEmail(newInvoice, user!.email!, stealthMeta);
        toast({ title: "Email sent", description: "Email sent!" });
        toast({ title: "Invoice created", description: <Link href={`https://base-sepolia.easscan.org/attestation/view/${uid}`} target="_blank" className="text-blue-500 hover:text-blue-800">View attestation</Link> });
        setIsLoading(false);
    }

    return <div className="h-full px-16 py-16">
        {user &&
            <>

                <form className="flex flex-wrap -mx-2" onSubmit={handleSubmit(onSubmit)}>
                    <div className="w-full sm:w-1/2 md:w-1/5 px-2 mb-4">
                        <Input
                            type="text"
                            placeholder="Name"
                            className="w-full p-2 border rounded"
                            {...register('name')}
                        />
                    </div>
                    <div className="w-full sm:w-1/2 md:w-1/5 px-2 mb-4">
                        <Input
                            type="email"
                            placeholder="Recipient Email"
                            className="w-full p-2 border rounded"
                            {...register('email')}
                        />
                    </div>
                    <div className="w-full sm:w-1/2 md:w-1/5 px-2 mb-4">
                        <Input
                            type="file"
                            accept=".pdf"
                            className="w-full p-2 border rounded"
                            {...register('pdf')}
                        />
                    </div>
                    <div className="w-full sm:w-1/2 md:w-1/5 px-2 mb-4">
                        <Button
                            disabled={isLoading}
                            type="submit"
                        > {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Send
                        </Button>
                    </div>
                </form>
                <Tabs defaultValue="sent" className="w-full">
                    <TabsList>
                        <TabsTrigger value="sent">Sent Invoices</TabsTrigger>
                        <TabsTrigger value="received">Received Invoices</TabsTrigger>
                    </TabsList>
                    <TabsContent value="sent">

                        <DataTable columns={sentColumns} data={displayedSentInvoices} />
                    </TabsContent>
                    <TabsContent value="received">
                        <DataTable columns={receivedColumns} data={displayedReceivedInvoices} />
                    </TabsContent>
                </Tabs>
            </>
        }
        {!user && <div className="w-full h-full flex flex-col justify-center items-center gap-16">
            <h1 className="text-8xl font-bold">Instealth</h1>
            <h2 className="text-4xl">Privacy-first settlement protocol for e-invoices</h2>
        </div>}
        {/* {isModalOpen && createPortal(<div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full">
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
        </div>, document.body)} */}
    </div>
}