import Invoices from "@/components/invoices";
import SignupLoginComponent from "@/components/signin";
import Link from "next/link";

const Home: React.FC = () => {
  return <div>
    <header className="flex justify-between items-center py-4 px-6 bg-background">
      <h1 className="text-2xl font-bold text-primary">Instealth</h1>
      <div className="flex items-center gap-4">
        <SignupLoginComponent />
      </div>
    </header>
    <Invoices />
  </div>;
}

export default Home;