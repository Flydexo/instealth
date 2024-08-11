"use client";

import { useEffect, useState } from "react";
import { base64ToFile } from "@/lib/utils";
import * as React from "react";
import { InvoiceStatus, useInvoiceStore } from "@/lib/stores";
import { useRouter } from "next/navigation";
import { createStealthClient } from "@scopelift/stealth-address-sdk";
import { baseSepolia } from "viem/chains";

export default function PaymentPage() {
    const router = useRouter();

    useEffect(() => {
        const urlParams = new URLSearchParams(window.location.hash.slice(2));
        const paramsObject = Object.fromEntries(urlParams.entries());
        useInvoiceStore.getState().updateInvoice(paramsObject.uid as string, { status: InvoiceStatus.Paid, fromAddress: decodeURIComponent(paramsObject.stealth!) });
        router.push('/');
    }, []);

    return <div className="flex flex-col gap-4">

    </div>;
}
