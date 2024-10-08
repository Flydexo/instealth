"use client";

import { useEffect, useState } from "react";
import { base64ToFile } from "@/lib/utils";
import * as React from "react";
import { InvoiceStatus, useInvoiceStore } from "@/lib/stores";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export default function InvoicePage() {
    const [params, setParams] = useState<any>();
    const [file, setFile] = useState<File>();
    const router = useRouter();


    useEffect(() => {
        const urlParams = new URLSearchParams(window.location.hash.slice(2));
        const paramsObject = Object.fromEntries(urlParams.entries());
        setParams(paramsObject);
        if (paramsObject.file) {
            base64ToFile(paramsObject.file, paramsObject.name as string).then(file => { console.log(file); setFile(file) });
        }
    }, []);

    return <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100">
        <div className="p-8 bg-white rounded-lg shadow-md">
            <h1 className="text-2xl font-bold">Add new Invoice</h1>
            {params && file && (
                <div className="flex flex-col gap-2">
                    <p>fromAddress: {params.fromAddress}</p>
                    <p>date: {params.date}</p>
                    <p>amount: {params.amount}</p>
                    <p>status: {params.status}</p>
                    <p>email: {decodeURIComponent(params.from)}</p>
                    <p>name: {params.name}</p>
                    <p>uid: {params.uid}</p>
                    <p>file: <a href={URL.createObjectURL(file)} download={file.name} className="text-blue-500 hover:text-blue-800">View PDF</a></p>
                    <Button
                        onClick={() => {
                            useInvoiceStore.getState().addReceivedInvoice({
                                date: params.date,
                                name: params.name,
                                amount: params.amount,
                                email: decodeURIComponent(params.from),
                                status: params.status as InvoiceStatus,
                                file: params.file,
                                uid: params.uid,
                                onchainInvoice: undefined,
                                fromAddress: params.fromAddress,
                            });
                            router.push('/');
                        }}
                    >
                        Add invoice
                    </Button>
                </div>
            )}
        </div>
    </div >;
}
