import { AuthForm } from "@/components/AuthForm";

export const metadata = { title: "Create account · WordTap" };

export default function SignupPage() {
  return <AuthForm mode="signup" />;
}
