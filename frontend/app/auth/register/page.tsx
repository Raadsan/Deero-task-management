import RegisterForm from "@/components/auth/RegisterForm";

export default function RegisterPage() {
  if (process.env.NODE_ENV === "production") return null;
  return <RegisterForm />;
}
