import { ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';

interface BreadcrumbItem {
  label: string;
  to?: string;
}

interface FormBreadcrumbProps {
  items: BreadcrumbItem[];
}

export function FormBreadcrumb({ items }: FormBreadcrumbProps) {
  return (
    <nav className="flex items-center gap-1 text-sm">
      {items.map((item, i) => {
        const isLast = i === items.length - 1;
        return (
          <span key={i} className="flex items-center gap-1">
            {i > 0 && <ChevronRight size={13} className="text-[var(--muted-foreground)] flex-shrink-0" />}
            {item.to && !isLast ? (
              <Link
                to={item.to}
                className="text-[var(--muted-foreground)] hover:text-[var(--card-foreground)] transition-colors truncate max-w-[180px]"
              >
                {item.label}
              </Link>
            ) : (
              <span className={`truncate max-w-[220px] ${isLast ? 'text-[var(--card-foreground)] font-medium' : 'text-[var(--muted-foreground)]'}`}>
                {item.label}
              </span>
            )}
          </span>
        );
      })}
    </nav>
  );
}
