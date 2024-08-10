import Invoices from "@/components/invoices";
import SignupLoginComponent from "@/components/signin";

const Home: React.FC = () => {
  return <div>
    <header className="flex justify-between items-center py-4 px-6 bg-background">
      <h1 className="text-2xl font-bold text-primary">Instealth</h1>
      <SignupLoginComponent />
    </header>
    <Invoices />
  </div>;
}

export default Home;