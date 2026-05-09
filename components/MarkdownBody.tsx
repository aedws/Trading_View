"use client";

import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";

/** 다크 UI용 — 커버드콜 리포트 등 마크다운 전용 */
const mdComponents: Partial<Components> = {
  h1: ({ children }) => (
    <h1 className="text-lg font-bold tracking-tight text-gray-100 mt-3 mb-2 first:mt-0">
      {children}
    </h1>
  ),
  h2: ({ children }) => (
    <h2 className="text-base font-semibold text-gray-100 mt-5 mb-2 pb-1 border-b border-border-soft">
      {children}
    </h2>
  ),
  h3: ({ children }) => (
    <h3 className="text-sm font-medium text-gray-200 mt-4 mb-1.5">{children}</h3>
  ),
  p: ({ children }) => (
    <p className="my-2 text-gray-300 leading-relaxed">{children}</p>
  ),
  ul: ({ children }) => (
    <ul className="list-disc pl-5 my-2 space-y-1.5 text-gray-300">{children}</ul>
  ),
  ol: ({ children }) => (
    <ol className="list-decimal pl-5 my-2 space-y-1.5 text-gray-300">{children}</ol>
  ),
  li: ({ children }) => <li className="leading-relaxed pl-0.5">{children}</li>,
  strong: ({ children }) => (
    <strong className="font-semibold text-gray-100">{children}</strong>
  ),
  em: ({ children }) => <em className="italic text-gray-400">{children}</em>,
  a: ({ href, children }) => (
    <a
      href={href}
      className="text-accent-blue hover:underline"
      target="_blank"
      rel="noopener noreferrer"
    >
      {children}
    </a>
  ),
  hr: () => <hr className="my-5 border-border-soft" />,
  blockquote: ({ children }) => (
    <blockquote className="border-l-2 border-amber-500/40 pl-3 my-3 text-gray-400 text-[12px] leading-relaxed">
      {children}
    </blockquote>
  ),
  code: (props) => {
    const { className, children, ...rest } = props;
    const inline = !className;
    if (inline) {
      return (
        <code
          className="px-1 py-px rounded bg-bg-soft text-[12px] font-mono text-sky-300/95"
          {...rest}
        >
          {children}
        </code>
      );
    }
    return (
      <code
        className={`block p-3 rounded-lg bg-bg/90 text-[11px] font-mono overflow-x-auto text-gray-300 ${className ?? ""}`}
        {...rest}
      >
        {children}
      </code>
    );
  },
  pre: ({ children }) => (
    <pre className="my-2 overflow-x-auto rounded-lg">{children}</pre>
  ),
  table: ({ children }) => (
    <div className="overflow-x-auto my-3 -mx-1">
      <table className="min-w-full text-[12px] border border-border-soft rounded-lg overflow-hidden border-collapse">
        {children}
      </table>
    </div>
  ),
  thead: ({ children }) => (
    <thead className="bg-bg-soft/90 text-gray-400">{children}</thead>
  ),
  tbody: ({ children }) => <tbody>{children}</tbody>,
  tr: ({ children }) => <tr className="border-b border-border-soft/40 last:border-0">{children}</tr>,
  th: ({ children }) => (
    <th className="text-left px-3 py-2 font-medium border-r border-border-soft/30 last:border-r-0">
      {children}
    </th>
  ),
  td: ({ children }) => (
    <td className="px-3 py-2 text-gray-200 border-r border-border-soft/20 last:border-r-0 align-top">
      {children}
    </td>
  ),
};

export default function MarkdownBody({ markdown }: { markdown: string }) {
  return (
    <div className="markdown-report px-1 py-0.5">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={mdComponents}>
        {markdown}
      </ReactMarkdown>
    </div>
  );
}
