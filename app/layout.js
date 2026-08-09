import "./globals.css";

export const metadata = {
  metadataBase: new URL("https://warp-transfer.vercel.app"),
  title: "Warp 3D — Ultra Fast P2P File Transfer",
  description:
    "Send files of any size, browser to browser, with ultra-fast P2P WebRTC streams and 3D visual portal. Built by Asad Lee.",
  openGraph: {
    title: "Warp 3D — Ultra Fast P2P File Transfer",
    description:
      "Send files of any size, browser to browser, with no upload and no size limit.",
    siteName: "Warp 3D",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Warp 3D — Ultra Fast P2P File Transfer",
    description:
      "Send files of any size, browser to browser, with no upload and no size limit.",
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className="dark">
      <body className="antialiased selection:bg-cyan-500 selection:text-black">{children}</body>
    </html>
  );
}
