import "./globals.css";
import { Providers } from "@/components/Providers";

export const metadata = {
  title: "Three Color Pets - Claw Machine Lottery",
  description: "Grab your fortune with Chainlink VRF powered pet lottery!",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900"
        suppressHydrationWarning
      >
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
