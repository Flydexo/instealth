import { easAbi } from "@/lib/abis/eas";
import { StandardMerkleTree } from "@openzeppelin/merkle-tree";
import { createPublicClient, decodeAbiParameters, http, zeroAddress } from "viem";
import { baseSepolia } from "viem/chains";

const ProofPage = async ({ searchParams }: { searchParams: { uid: string, taxAmount: string, proof: string } }) => {
    console.log(searchParams);
    const publicClient = createPublicClient({
        chain: baseSepolia,
        transport: http()
    });
    const uid = searchParams.uid;
    const taxAmount = searchParams.taxAmount;
    const { data: root } = await publicClient.readContract({
        abi: easAbi.abi,
        address: easAbi.address,
        functionName: "getAttestation",
        args: [uid as `0x${string}`]
    });
    const isValid = StandardMerkleTree.verify(root, ["string", "string"], ["tradeSettlement.taxTotalAmount.value", taxAmount], JSON.parse(decodeURIComponent(searchParams.proof)));

    return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100">
            <div className="p-8 bg-white rounded-lg shadow-md">
                <h1 className="text-2xl font-bold mb-4">Tax Proof Verification</h1>
                <p className="mb-2"><strong>Invoice UID:</strong> {uid}</p>
                <p className="mb-4"><strong>Tax Amount:</strong> {taxAmount}€</p>
                {isValid !== null && (
                    <p className={`text-lg font-semibold ${isValid ? 'text-green-600' : 'text-red-600'}`}>
                        {isValid ? 'Proof Valid' : 'Proof Invalid'}
                    </p>
                )}
            </div>
        </div>
    );
};
export default ProofPage;