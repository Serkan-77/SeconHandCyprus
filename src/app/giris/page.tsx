import { LoginForm } from "./LoginForm";

export const metadata = { title: "Giriş yap" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ returnTo?: string; hata?: string }>;
}) {
  const { returnTo, hata } = await searchParams;
  return <LoginForm returnTo={returnTo ?? "/"} linkError={hata === "baglanti"} />;
}
