import SignupLoginComponent from "@/components/signin";

export default function Home() {

  return <div>
    <header className="flex justify-between items-center py-4 px-6 bg-background">
      <h1 className="text-2xl font-bold text-primary">Instealth</h1>
      <SignupLoginComponent/>
    </header>
  </div>;
}