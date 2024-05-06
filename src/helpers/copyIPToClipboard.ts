import { toast } from "react-hot-toast";
export async function copyIPToClipboard(ip: string) {
  try {
    await navigator.clipboard.writeText(ip);
    toast.success(`${ip} copied!`, {
      position:"bottom-center",
      style: {
        borderRadius: '10px',
        background: '#333',
        color: '#fff',
      },
    });
  } catch (error) {
    toast.error(`Failed to copy IP ${ip} to clipboard!`);
    console.error(error);
  }
}
