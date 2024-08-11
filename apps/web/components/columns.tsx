"use client"

import { Invoice, useInvoiceStore } from "@/lib/stores"
import { InvoiceStatus } from "@repo/emails/invoice"
import { ColumnDef } from "@tanstack/react-table"
import { getFile } from "./invoices"
import { Button } from "@/components/ui/button"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Loader2, MoreHorizontal } from "lucide-react"
import { sendPaymentEmail, sendProofEmail, sendRejectInvoice } from "@/lib/actions"
import { toast } from "./ui/use-toast"
import { useSmartAccountClient, useUser } from "@alchemy/aa-alchemy/react"
import { cn, EURC, extractEmbeddedXML } from "@/lib/utils"
import { StandardMerkleTree } from "@openzeppelin/merkle-tree"
import { gasManagerConfig } from "@/lib/config"
import { generateStealthAddress } from "@scopelift/stealth-address-sdk"
import { encodeFunctionData, erc20Abi, parseEther, toFunctionSelector, toHex } from "viem"
import { stealthAbi } from "@/lib/abis/stealth"
import Link from "next/link"
import { useState } from "react"

export const receivedColumns: ColumnDef<Omit<Invoice, 'file'> & { file: File }>[] = [
    {
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => {
            return <div className={cn("capitalize", row.original.status === "sent" ? "text-blue-500" : row.original.status === "rejected" ? "text-red-500" : "text-green-500")}>{row.original.status}</div>
        },
    },
    {
        accessorKey: "date",
        header: "Date",
    },
    {
        accessorKey: "name",
        header: "Name",
    },
    {
        accessorKey: "email",
        header: "Email",
    },
    {
        accessorKey: "amount",
        header: "Amount",
        cell: ({ row }) => {
            return <div>{Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', currencyDisplay: 'symbol' }).format(Number(row.original.amount))}</div>
        },
    },
    {
        accessorKey: "file",
        header: "File",
        cell: ({ row }) => {
            return <a href={URL.createObjectURL(row.original.file)} download={row.original.file.name} className="text-blue-500 hover:text-blue-800">View PDF</a>
        },
    },
    {
        id: "actions",
        cell: ({ row }) => {
            const user = useUser();
            const { client } = useSmartAccountClient({ type: "LightAccount", gasManagerConfig });
            const [isPayLoading, setIsPayLoading] = useState(false);
            const [isProveTaxesLoading, setIsProveTaxesLoading] = useState(false);
            const [isRejectLoading, setIsRejectLoading] = useState(false);

            return (
                <>{row.original.status !== "rejected" && (<div className="flex items-center justify-center gap-2">
                    <Button disabled={isRejectLoading} variant="destructive" onClick={async () => {
                        setIsRejectLoading(true);
                        await sendRejectInvoice(row.original.uid, row.original.email, user!.email as string, row.original.name);
                        useInvoiceStore.getState().updateInvoice(row.original.uid, { status: InvoiceStatus.Rejected })
                        toast({
                            title: "Rejection email sent",
                            description: `Email sent to ${row.original.email}`,
                        })
                        setIsRejectLoading(false);
                    }}>
                        {isRejectLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                        Reject
                    </Button>
                    <Button disabled={isPayLoading} variant="default" onClick={async () => {
                        if (!client) return;
                        setIsPayLoading(true);
                        toast({
                            title: "Sending payment",
                            description: `Sending ${row.original.amount}€ to ${row.original.email}`,
                        });
                        const { stealthAddress, ephemeralPublicKey, viewTag } = generateStealthAddress({ stealthMetaAddressURI: row.original.fromAddress! })
                        const uo = await client.sendUserOperation({
                            uo: {
                                target: EURC,
                                data: encodeFunctionData({
                                    abi: erc20Abi,
                                    functionName: 'transfer',
                                    args: [stealthAddress, parseEther(row.original.amount)]
                                })
                            }
                        });
                        const hash = await client.waitForUserOperationTransaction(uo);
                        toast({
                            title: "Announcing payment",
                            description: `Announcing payment to ${row.original.email}`,
                        });
                        const announceUO = await client.sendUserOperation({
                            uo: {
                                target: stealthAbi.address,
                                data: encodeFunctionData({
                                    abi: stealthAbi.abi,
                                    functionName: 'announce',
                                    args: [1n, stealthAddress, ephemeralPublicKey, `${viewTag}${toFunctionSelector('function transfer(address,uint256) returns (bool)').slice(2)}${EURC.slice(2)}${toHex(parseEther(row.original.amount)).slice(2)}`]
                                })
                            }
                        });
                        await client.waitForUserOperationTransaction(announceUO);
                        toast({
                            title: "Sending email",
                            description: `Sending email to ${row.original.email}`,
                        });
                        await sendPaymentEmail(row.original.email, Number(row.original.amount), row.original.uid, row.original.name, user!.email as string, stealthAddress);
                        toast({
                            title: "Email sent",
                            description: `Email sent to ${row.original.email}`,
                        });
                        toast({ title: "Transaction sent", description: <Link href={`https://base-sepolia.blockscout.com/tx/${hash}`} target="_blank" className="text-blue-500 hover:text-blue-800">See transaction on Blockscout</Link> });
                        setIsPayLoading(false);
                        useInvoiceStore.getState().updateInvoice(row.original.uid, { status: InvoiceStatus.Paid });
                    }}>
                        {isPayLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                        Pay {Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', currencyDisplay: 'symbol' }).format(Number(row.original.amount))}
                    </Button>
                    {row.original.status === InvoiceStatus.Paid && <Button disabled={isProveTaxesLoading} variant="secondary" onClick={async () => {
                        setIsProveTaxesLoading(true);
                        const onchainInvoice = await extractEmbeddedXML(await row.original.file.arrayBuffer());
                        if (!onchainInvoice) return;
                        useInvoiceStore.getState().updateInvoice(row.original.uid, { onchainInvoice });
                        const onchainInvoiceLeafs: string[][] = [
                            ["ID", onchainInvoice.ID],
                            ["date.value", onchainInvoice.date.value],
                            ["date.format", onchainInvoice.date.format],
                            ["typeCode", onchainInvoice.typeCode],
                            ["issuerAssignedID", onchainInvoice.issuerAssignedID],
                            ["buyerTradeParty.name", onchainInvoice.buyerTradeParty.name],
                            ["buyerTradeParty.specifiedLegalOrganizationID.value", onchainInvoice.buyerTradeParty.specifiedLegalOrganizationID.value],
                            ["buyerTradeParty.specifiedLegalOrganizationID.schemeID", onchainInvoice.buyerTradeParty.specifiedLegalOrganizationID.schemeID],
                            ["sellerTradeParty.name", onchainInvoice.sellerTradeParty.name],
                            ["sellerTradeParty.postalTradeAddress.countryID", onchainInvoice.sellerTradeParty.postalTradeAddress.countryID],
                            ["sellerTradeParty.specifiedLegalOrganizationID.value", onchainInvoice.sellerTradeParty.specifiedLegalOrganizationID.value],
                            ["sellerTradeParty.specifiedLegalOrganizationID.schemeID", onchainInvoice.sellerTradeParty.specifiedLegalOrganizationID.schemeID],
                            ["sellerTradeParty.specifiedTaxRegistrationID.value", onchainInvoice.sellerTradeParty.specifiedTaxRegistrationID.value],
                            ["sellerTradeParty.specifiedTaxRegistrationID.schemeID", onchainInvoice.sellerTradeParty.specifiedTaxRegistrationID.schemeID],
                            ["tradeSettlement.invoiceCurrencyCode", onchainInvoice.tradeSettlement.invoiceCurrencyCode],
                            ["tradeSettlement.duePayableAmount", onchainInvoice.tradeSettlement.duePayableAmount],
                            ["tradeSettlement.taxBasisTotalAmount", onchainInvoice.tradeSettlement.taxBasisTotalAmount],
                            ["tradeSettlement.taxTotalAmount.value", onchainInvoice.tradeSettlement.taxTotalAmount.value],
                            ["tradeSettlement.taxTotalAmount.currencyID", onchainInvoice.tradeSettlement.taxTotalAmount.currencyID]
                        ];
                        const tree = StandardMerkleTree.of(onchainInvoiceLeafs, ["string", "string"]);
                        const proof = tree.getProof(["tradeSettlement.taxTotalAmount.value", onchainInvoice.tradeSettlement.taxTotalAmount.value]);
                        await sendProofEmail(user!.email as string, proof, row.original.uid, onchainInvoice.tradeSettlement.taxTotalAmount.value);
                        toast({
                            title: "Tax proof sent",
                            description: `Email sent to ${user!.email}`,
                        })
                        setIsProveTaxesLoading(false);
                    }}>
                        {isProveTaxesLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                        Prove taxes
                    </Button>}
                </div>)}</>
            )
        },
    },
]

export const sentColumns: ColumnDef<Omit<Invoice, 'file'> & { file: File }>[] = [
    {
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => {
            return <div className={cn("capitalize", "flex items-center gap-2", row.original.status === "sent" ? "text-blue-500" : row.original.status === "rejected" ? "text-red-500" : "text-green-500")}>{row.original.status}{row.original.status === "paid" && <a href={`https://base-sepolia.blockscout.com/address/${row.original.fromAddress}`} target="_blank" className="text-blue-500 hover:text-blue-800">View receipt</a>}</div>
        },
    },
    {
        accessorKey: "date",
        header: "Date",
    },
    {
        accessorKey: "name",
        header: "Name",
    },
    {
        accessorKey: "email",
        header: "Email",
    },
    {
        accessorKey: "amount",
        header: "Amount",
        cell: ({ row }) => {
            return <div>{Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', currencyDisplay: 'symbol' }).format(Number(row.original.amount))}</div>
        },
    },
    {
        accessorKey: "file",
        header: "File",
        cell: ({ row }) => {
            return <a href={URL.createObjectURL(row.original.file)} download={row.original.file.name} className="text-blue-500 hover:text-blue-800">View PDF</a>
        },
    },
    {
        id: "actions",
        cell: ({ row }) => {
            const user = useUser();
            const { client } = useSmartAccountClient({ type: "LightAccount", gasManagerConfig });
            const [isProveTaxesLoading, setIsProveTaxesLoading] = useState(false);

            return (
                <>{row.original.status !== "rejected" && (<div className="flex items-center justify-center gap-2">
                    {row.original.status === InvoiceStatus.Paid && <Button disabled={isProveTaxesLoading} variant="secondary" onClick={async () => {
                        setIsProveTaxesLoading(true);
                        const onchainInvoice = await extractEmbeddedXML(await row.original.file.arrayBuffer());
                        if (!onchainInvoice) return;
                        useInvoiceStore.getState().updateInvoice(row.original.uid, { onchainInvoice });
                        const onchainInvoiceLeafs: string[][] = [
                            ["ID", onchainInvoice.ID],
                            ["date.value", onchainInvoice.date.value],
                            ["date.format", onchainInvoice.date.format],
                            ["typeCode", onchainInvoice.typeCode],
                            ["issuerAssignedID", onchainInvoice.issuerAssignedID],
                            ["buyerTradeParty.name", onchainInvoice.buyerTradeParty.name],
                            ["buyerTradeParty.specifiedLegalOrganizationID.value", onchainInvoice.buyerTradeParty.specifiedLegalOrganizationID.value],
                            ["buyerTradeParty.specifiedLegalOrganizationID.schemeID", onchainInvoice.buyerTradeParty.specifiedLegalOrganizationID.schemeID],
                            ["sellerTradeParty.name", onchainInvoice.sellerTradeParty.name],
                            ["sellerTradeParty.postalTradeAddress.countryID", onchainInvoice.sellerTradeParty.postalTradeAddress.countryID],
                            ["sellerTradeParty.specifiedLegalOrganizationID.value", onchainInvoice.sellerTradeParty.specifiedLegalOrganizationID.value],
                            ["sellerTradeParty.specifiedLegalOrganizationID.schemeID", onchainInvoice.sellerTradeParty.specifiedLegalOrganizationID.schemeID],
                            ["sellerTradeParty.specifiedTaxRegistrationID.value", onchainInvoice.sellerTradeParty.specifiedTaxRegistrationID.value],
                            ["sellerTradeParty.specifiedTaxRegistrationID.schemeID", onchainInvoice.sellerTradeParty.specifiedTaxRegistrationID.schemeID],
                            ["tradeSettlement.invoiceCurrencyCode", onchainInvoice.tradeSettlement.invoiceCurrencyCode],
                            ["tradeSettlement.duePayableAmount", onchainInvoice.tradeSettlement.duePayableAmount],
                            ["tradeSettlement.taxBasisTotalAmount", onchainInvoice.tradeSettlement.taxBasisTotalAmount],
                            ["tradeSettlement.taxTotalAmount.value", onchainInvoice.tradeSettlement.taxTotalAmount.value],
                            ["tradeSettlement.taxTotalAmount.currencyID", onchainInvoice.tradeSettlement.taxTotalAmount.currencyID]
                        ];
                        const tree = StandardMerkleTree.of(onchainInvoiceLeafs, ["string", "string"]);
                        const proof = tree.getProof(["tradeSettlement.taxTotalAmount.value", onchainInvoice.tradeSettlement.taxTotalAmount.value]);
                        await sendProofEmail(user!.email as string, proof, row.original.uid, onchainInvoice.tradeSettlement.taxTotalAmount.value);
                        toast({
                            title: "Tax proof sent",
                            description: `Email sent to ${user!.email}`,
                        })
                        setIsProveTaxesLoading(false);
                    }}>
                        {isProveTaxesLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                        Prove taxes
                    </Button>}
                </div>)}</>
            )
        },
    },
]
