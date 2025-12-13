

import React from 'react';
import { marked } from 'marked';
import DOMPurify from 'dompurify';

interface MarkdownRendererProps {
  content: string;
  className?: string;
}

const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({ content, className }) => {
  const getMarkup = () => {
    const rawMarkup = marked.parse(content || '');
    const cleanMarkup = DOMPurify.sanitize(rawMarkup as string, { USE_PROFILES: { html: true } });
    return { __html: cleanMarkup };
  };

  return (
    <div
      className={`markdown-body prose max-w-none text-gray-800 leading-relaxed ${className || ''}`}
      dangerouslySetInnerHTML={getMarkup()}
    />
  );
};

export default MarkdownRenderer;