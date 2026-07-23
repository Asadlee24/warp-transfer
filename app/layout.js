import "./globals.css";

export const metadata = {
  metadataBase: new URL("https://warp-transfer.vercel.app"),
  title: "Warp — Instant P2P File Transfer",
  description:
    "Send files of any size, browser to browser, with no upload and no size limit. Built by Asad Lee.",
  openGraph: {
    title: "Warp — Instant P2P File Transfer",
    description:
      "Send files of any size, browser to browser, with no upload and no size limit.",
    siteName: "Warp",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Warp — Instant P2P File Transfer",
    description:
      "Send files of any size, browser to browser, with no upload and no size limit.",
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="font-body">{children}</body>
    </html>
  );
}
