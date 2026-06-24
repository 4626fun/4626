import clsx from 'clsx';
import {
  PERSONA_OPTIONS,
  type PersonaId,
} from '@site/src/lib/personas';

type PersonaSwitcherProps = {
  value: PersonaId;
  onChange: (next: PersonaId) => void;
};

export default function PersonaSwitcher({
  value,
  onChange,
}: PersonaSwitcherProps): React.JSX.Element {
  return (
    <div className="persona-switcher" role="navigation" aria-label="Docs persona">
      <span className="persona-switcher__label">Browse as</span>
      <div className="persona-switcher__pills">
        {PERSONA_OPTIONS.map((option) => (
          <button
            key={option.id}
            type="button"
            className={clsx(
              'persona-switcher__pill',
              value === option.id && 'persona-switcher__pill--active',
            )}
            aria-pressed={value === option.id}
            title={option.label}
            onClick={() => onChange(option.id)}>
            {option.shortLabel}
          </button>
        ))}
      </div>
    </div>
  );
}
