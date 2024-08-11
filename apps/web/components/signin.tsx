"use client";

import { gasManagerConfig } from "@/lib/config";
import { EURC } from "@/lib/utils";
import { useAuthenticate, useSigner, useSignerStatus, useSmartAccountClient, useUser } from "@alchemy/aa-alchemy/react";
import { Copy, Mail, User } from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { formatUnits } from "viem";
import { useBalance } from 'wagmi'
import { Button } from "./ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "./ui/card";
import { Label } from "./ui/label";
import { Input } from "./ui/input";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { useToast } from "./ui/use-toast";
import { Avatar, AvatarFallback } from "./ui/avatar";
import { Badge } from "./ui/badge";
import { InvoiceStatus, useInvoiceStore } from "@/lib/stores";

const loginFormSchema = z.object({
  email: z.string().email(),
})

const SignupLoginComponent = () => {
  const [modalOpen, setModalOpen] = useState(false);
  const { authenticate } = useAuthenticate();
  const { status } = useSignerStatus();
  const user = useUser();
  const { client } = useSmartAccountClient({ type: 'LightAccount', gasManagerConfig });
  const balance = useBalance({ address: client?.account.address, token: EURC });
  const form = useForm<z.infer<typeof loginFormSchema>>({
    resolver: zodResolver(loginFormSchema),
    defaultValues: {
      email: "",
    },
  });
  const { toast } = useToast();

  function onSubmit(values: z.infer<typeof loginFormSchema>) {
    authenticate({ type: "email", email: values.email });
    setModalOpen(false);
    toast({
      title: "Email sent",
      description: "Check your email for a magic link to login",
    });
  }

  return (
    <>
      {status !== "CONNECTED" ? (
        <Button
          onClick={() => setModalOpen(true)}
        >
          <Mail className="mr-2 h-4 w-4" />
          Login with Email
        </Button>
      ) : (
        <div className="flex items-center space-x-2">
          <Badge>
            {balance.data && <span>{Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', currencyDisplay: 'symbol' }).format(Number(formatUnits(balance.data.value, balance.data?.decimals)) + useInvoiceStore.getState().sentInvoices.filter(invoice => invoice.status === InvoiceStatus.Paid).map<number>(i => Number(i.amount)).reduce((acc, invoice) => acc + invoice, 0))}</span>}
          </Badge>
          <Button variant="outline" size="icon">
            <Copy className="h-4 w-4" onClick={() => {
              navigator.clipboard.writeText(client?.account.address!);
              toast({
                title: "Address copied",
                description: "Address copied to clipboard",
              });
            }} />
          </Button>
          <Avatar>
            <AvatarFallback>{user?.email?.slice(0, 2).toUpperCase()}</AvatarFallback>
          </Avatar>
        </div>
      )}

      {modalOpen && createPortal(
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
          <Card className="w-[400px]">
            <CardHeader>
              <CardTitle>Login with Email</CardTitle>
              <CardDescription>Enter your email to login</CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email</FormLabel>
                        <FormControl>
                          <Input placeholder="john.doe@example.com" {...field} />
                        </FormControl>
                        <FormDescription>
                          Enter your email to login
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <Button type="submit">Login</Button>
                </form>
              </Form>
            </CardContent>
          </Card>
        </div>,
        document.body
      )}
    </>

  );
};

export default SignupLoginComponent;