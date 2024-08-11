"use client"

import { useExportAccount } from "@alchemy/aa-alchemy/react";
import { useState } from "react";
import { toHex } from "viem";
import { mnemonicToAccount } from "viem/accounts";
import { generateRandomStealthMetaAddress, generateStealthAddress } from "@scopelift/stealth-address-sdk"
import { createPortal } from "react-dom";

export default function ComponentWithExportAccount() {
    const [seedPhrase, setSeedPhrase] = useState("");
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [modalStatus, setModalStatus] = useState("");

    /**
     * Assumes the app has context of a signer with an authenticated user
     * by using the `AlchemyAccountProvider` from `@alchemy/aa-alchemy/react`.
     */
    const { exportAccount, isExported, isExporting, ExportAccountComponent } =
        useExportAccount({
            onSuccess: (hasSuccessfullyExported) => {
                // [optional] Do something after the account credentials have been exported
            },
            onError: (error) => {
                // [optional] Do something with the error
            },
            // [optional] ...additional mutationArgs
        });

    return (
        <div>
            {!isExported ? (
                <button onClick={() => exportAccount()} disabled={isExporting}>
                    Export Account
                </button>
            ) : (
                <strong>Seed Phrase</strong>
            )}
            <ExportAccountComponent className="w-full" isExported={isExported} />
            <form className="mt-4">
                <label htmlFor="seedPhrase" className="block text-sm font-medium text-gray-700">
                    Enter Seed Phrase
                </label>
                <div className="mt-1">
                    <textarea
                        id="seedPhrase"
                        name="seedPhrase"
                        rows={3}
                        className="shadow-sm focus:ring-indigo-500 focus:border-indigo-500 mt-1 block w-full sm:text-sm border border-gray-300 rounded-md"
                        placeholder="Enter your 12 or 24 word seed phrase"
                        value={seedPhrase}
                        onChange={(e) => setSeedPhrase(e.target.value)}
                    ></textarea>
                </div>
                <div className="mt-2">
                    <button
                        type="submit"
                        className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                        onClick={(e) => {
                            e.preventDefault();
                            const viewingAccount = mnemonicToAccount(seedPhrase, { accountIndex: 101 });
                            const spendingAccount = mnemonicToAccount(seedPhrase, { accountIndex: 102 });
                            const viewingPrivateKey = toHex(viewingAccount.getHdKey().privateKey!)
                            const spendingPrivateKey = toHex(spendingAccount.getHdKey().privateKey!)
                            localStorage.setItem("viewingPrivateKey", viewingPrivateKey);
                            localStorage.setItem("spendingPrivateKey", spendingPrivateKey);
                            const stealthMeta = `st:basesep:0x${Buffer.from(spendingAccount.getHdKey().publicKey!).toString("hex")}${Buffer.from(viewingAccount.getHdKey().publicKey!).toString("hex")}`;
                            localStorage.setItem("stealthMeta", stealthMeta);
                            setIsModalOpen(true);
                            setModalStatus(`Account imported successfully!`);
                        }}
                    >
                        Import Account
                    </button>
                </div>
            </form>
            {isModalOpen && createPortal(
                <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full">
                    <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
                        <div className="mt-3 text-center">
                            <h3 className="text-lg leading-6 font-medium text-gray-900">Import Status</h3>
                            <div className="mt-2 px-7 py-3">
                                <p className="text-sm text-gray-500">
                                    {modalStatus}
                                </p>
                            </div>
                            <div className="items-center px-4 py-3">
                                <button
                                    id="ok-btn"
                                    className="px-4 py-2 bg-blue-500 text-white text-base font-medium rounded-md w-full shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-300"
                                    onClick={() => setIsModalOpen(false)}
                                >
                                    OK
                                </button>
                            </div>
                        </div>
                    </div>
                </div>,
                document.body
            )}
        </div>
    );
}