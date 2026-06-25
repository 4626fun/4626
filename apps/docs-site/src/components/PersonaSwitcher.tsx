import clsx from 'clsx';
import {
  getPersonaOption,
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
  const activePersona = getPersonaOption(value);

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
            title={option.description}
            onClick={() => onChange(option.id)}>
            {option.shortLabel}
          </button>
        ))}
      </div>
      <p className="persona-switcher__desc">{activePersona.description}</p>
    </div>
  );
}
