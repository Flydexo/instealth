"use client";

import { useEffect, useState } from "react";
import { base64ToFile } from "@/lib/utils";
import * as React from "react";
import { InvoiceStatus, useInvoiceStore } from "@/lib/stores";
import { useRouter } from "next/navigation";

export default function RejectPage() {
    const router = useRouter();


    useEffect(() => {
        const urlParams = new URLSearchParams(window.location.hash.slice(2));
        const paramsObject = Object.fromEntries(urlParams.entries());
        useInvoiceStore.getState().setInvoiceStatus(paramsObject.uid as string, InvoiceStatus.Rejected);
        router.push('/');
    }, []);

    return <div className="flex flex-col gap-4">

    </div>;
}
