import { LoginForm } from "./login-form";

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="card w-full max-w-sm p-6">
        <h1 className="text-lg font-semibold">Creator Retainers</h1>
        <p className="mb-5 text-sm text-slate-500">Sign in with your team account</p>
        <LoginForm />
      </div>
    </div>
  );
}
