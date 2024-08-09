"use client";

import { InvoiceStatus, useInvoiceStore } from "@/lib/stores";
import { useEffect, useState } from "react";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { extractEmbeddedXML } from "@/lib/utils";

const invoiceSchema = z.object({
    name: z.string(),
    email: z.string().email(),
    pdf: z.any().refine((value) => {
        console.log(value);
        return value instanceof FileList;
    }, { message: "Invalid file" }).refine((value: FileList) => value.length > 0, { message: "File is required" }).refine((value: FileList) => value.item(0)?.type === "application/pdf", { message: "Invalid file type" }),
});

export default function Invoices() {
    const { sentInvoices, receivedInvoices, setSentInvoices, setReceivedInvoices } = useInvoiceStore();

    const [activeTab, setActiveTab] = useState('sent');

    const displayInvoices = activeTab === 'sent' ? sentInvoices : receivedInvoices;

    const {register, handleSubmit, formState: {errors}} = useForm<z.infer<typeof invoiceSchema>>({
        resolver: zodResolver(invoiceSchema),
    });

    const onSubmit = async (data: z.infer<typeof invoiceSchema>) => {
        const invoice = await extractEmbeddedXML(await data.pdf[0]!.arrayBuffer());
        console.log(invoice);
    }

    useEffect(() => {
        // Set default invoices for sent and received
        if (sentInvoices.length === 0) {
            setSentInvoices([
                { date: '2023-06-01', name: 'Client A', amount: '1000.00', email: 'clientA@example.com', status: InvoiceStatus.Sent},
                { date: '2023-06-15', name: 'Client B', amount: '1500.00', email: 'clientB@example.com', status: InvoiceStatus.Paid },
            ]);
        }
        
        if (receivedInvoices.length === 0) {
            setReceivedInvoices([
                { date: '2023-05-20', name: 'Supplier X', amount: '800.00', email: 'supplierX@example.com', status: InvoiceStatus.Received },
                { date: '2023-06-05', name: 'Supplier Y', amount: '1200.00', email: 'supplierY@example.com', status: InvoiceStatus.Paid },
            ]);
        }
    }, []);
    
    return  <main className="container mx-auto mt-8 px-4">
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
                  <a href="#" className="text-blue-500 hover:text-blue-800">View PDF</a>
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
    </main>

}