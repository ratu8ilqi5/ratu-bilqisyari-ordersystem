import "./globals.css";
import { APP_NAME } from "@/lib/constants";

export const metadata = {
  title: APP_NAME,
  description: "Sistem order dan invoice untuk Ratu Bilqis Syar'i",
};

export default function RootLayout({ children }) {
  return (
    <html lang="id">
      <body className="ff-body min-h-screen">{children}</body>
    </html>
  );
}
