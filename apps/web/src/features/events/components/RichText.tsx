import { Fragment } from 'react';

import { parseRichText, type Inline } from '../utils/rich-text';

function Inlines({ parts }: { parts: Inline[] }) {
  return parts.map((part, index) => {
    switch (part.kind) {
      case 'bold':
        return <strong key={index}>{part.text}</strong>;
      case 'link':
        return (
          <a key={index} href={part.href} target="_blank" rel="noopener noreferrer nofollow" className="underline underline-offset-4">
            {part.text}
          </a>
        );
      case 'break':
        return <br key={index} />;
      default:
        return <Fragment key={index}>{part.text}</Fragment>;
    }
  });
}

/** An event's description, drawn from its parsed blocks — elements only, never HTML. */
export function RichText({ source }: { source: string }) {
  return (
    <div className="flex flex-col gap-3 text-sm leading-loose">
      {parseRichText(source).map((block, index) => {
        if (block.kind === 'heading') {
          const Heading = block.level === 2 ? 'h3' : 'h4';
          return (
            <Heading key={index} className={block.level === 2 ? 'text-base font-bold' : 'text-sm font-bold'}>
              <Inlines parts={block.content} />
            </Heading>
          );
        }
        if (block.kind === 'list') {
          return (
            <ul key={index} className="list-disc ps-5">
              {block.items.map((item, i) => (
                <li key={i}>
                  <Inlines parts={item} />
                </li>
              ))}
            </ul>
          );
        }
        return (
          <p key={index}>
            <Inlines parts={block.content} />
          </p>
        );
      })}
    </div>
  );
}
