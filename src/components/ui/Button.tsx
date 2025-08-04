// components/ui/Button.tsx
import React from 'react';

type ButtonProps = {
  isLoading?: boolean;
} & React.ComponentProps<'button'>;

export default function Button({ children, isLoading = false, ...props }: ButtonProps) {
  return (
    <button
      className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-purple-600 hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 disabled:bg-gray-400 disabled:cursor-not-allowed"
      disabled={isLoading}
      {...props}
    >
      {isLoading ? 'Yükleniyor...' : children}
    </button>
  );
}