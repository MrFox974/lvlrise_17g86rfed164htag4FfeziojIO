import { useState, useCallback } from 'react';
import { PASSWORD_RULES, isPasswordValid } from '../utils/passwordValidation';

function PasswordInput({
  value,
  onChange,
  placeholder = 'Mot de passe',
  showValidation = false,
  disabled = false,
  error = null,
  id = 'password',
  className = '',
}) {
  const [showPassword, setShowPassword] = useState(false);

  const handleToggleVisibility = useCallback(() => {
    setShowPassword((prev) => !prev);
  }, []);

  return (
    <div className={`space-y-1 ${className}`}>
      <div className="relative">
        <input
          id={id}
          type={showPassword ? 'text' : 'password'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          disabled={disabled}
          className={`w-full px-4 py-3 pr-12 rounded-[10px] border transition-colors
            ${error ? 'border-[var(--om-warning)] bg-[var(--om-warning-soft)]/30' : 'border-[var(--om-line)]'}
            focus:outline-none focus:ring-2 focus:ring-[var(--om-accent)]/40 focus:border-[var(--om-accent)]
            placeholder:text-[var(--om-muted)]/60 text-[var(--om-text)]
            disabled:bg-[var(--om-surface-2)] disabled:cursor-not-allowed`}
          autoComplete={showValidation ? 'new-password' : 'current-password'}
        />
        <button
          type="button"
          onClick={handleToggleVisibility}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--om-muted)] hover:text-[var(--om-text)] transition-colors p-1"
          aria-label={showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
        >
          {showPassword ? (
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
            </svg>
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          )}
        </button>
      </div>

      {showValidation && (
        <ul className="space-y-1.5 text-sm">
          {PASSWORD_RULES.map((rule) => {
            const valid = rule.test(value);
            return (
              <li
                key={rule.label}
                className={`flex items-center gap-2 transition-colors ${
                  valid ? 'text-[var(--om-accent)]' : 'text-[var(--om-muted)]'
                }`}
              >
                <span className="relative w-3 h-3 shrink-0 flex items-center justify-center">
                  {valid ? (
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="w-3 h-3 shrink-0 text-[var(--om-success)] password-check-draw"
                    >
                      <path
                        d="M5 13l4 4L19 7"
                        strokeDasharray="30"
                        strokeDashoffset="30"
                        className="password-check-path"
                      />
                    </svg>
                  ) : (
                    <span className="w-2.5 h-2.5 rounded-full border border-[var(--om-line)] block" />
                  )}
                </span>
                {rule.label}
              </li>
            );
          })}
          {value.length > 0 && isPasswordValid(value) && (
            <li className="text-[var(--om-success)] font-medium pt-1">
              Mot de passe valide
            </li>
          )}
        </ul>
      )}

      {error && (
        <p className="text-sm text-[var(--om-warning)]">{error}</p>
      )}
    </div>
  );
}

export default PasswordInput;
