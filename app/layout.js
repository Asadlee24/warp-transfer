import "./globals.css";

export const metadata = {
  title: "Warp — Instant P2P File Transfer",
  description:
    "Send files of any size, browser to browser, with no upload and no size limit. Built by Asad Lee.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="font-body">{children}</body>
    </html>
  );
}
