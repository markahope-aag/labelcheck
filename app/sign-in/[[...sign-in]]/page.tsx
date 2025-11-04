import { SignIn } from '@clerk/nextjs';

export default function SignInPage() {
  return (
    <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center bg-gradient-to-b from-slate-50 to-white py-12 px-4 sm:px-6 lg:px-8">
      <SignIn
        appearance={{
          elements: {
            rootBox: 'mx-auto w-full',
            card: 'shadow-xl border border-slate-200',
            headerTitle: 'text-2xl font-bold',
            headerSubtitle: 'text-slate-600',
            socialButtonsBlockButton: 'border border-slate-300 hover:bg-slate-50',
            formButtonPrimary: 'bg-blue-600 hover:bg-blue-700 text-white',
            footerActionLink: 'text-blue-600 hover:text-blue-700',
            formFieldInput: 'border-slate-300 focus:border-blue-500',
          },
        }}
      />
    </div>
  );
}
