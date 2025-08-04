// components/ui/Input.tsx
import React from 'react';

// Input'un alacağı propların tiplerini belirliyoruz.
// React.ComponentProps<'input'> ile standart tüm input proplarını miras alıyoruz.
type InputProps = {
  label: string;
  id: string;
} & React.ComponentProps<'input'>;

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ label, id, type = 'text', ...props }, ref) => {
    return (
      <div>
        <label htmlFor={id} className="block text-sm font-medium text-gray-700">
          {label}
        </label>
        <input
          id={id}
          name={id} // Form state'ini güncellerken bu name'i kullanacağız.
          type={type}
          ref={ref}
          className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-purple-500 focus:border-purple-500 sm:text-sm text-black"
          {...props}
        />
      </div>
    );
  }
);

Input.displayName = 'Input';

export default Input;