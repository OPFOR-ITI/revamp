import { redirectIfSignedIn } from "@/lib/auth-guards";
import { SignUpForm } from "@/components/auth/sign-up-form";

export default async function SignUpPage() {
  await redirectIfSignedIn();

  return <SignUpForm />;
}
