export function formatBeijingTime(value) {
  if (!value) {
    return '-';
  }

  const normalizedValue = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(normalizedValue)) {
    return normalizedValue;
  }

  const date = new Date(normalizedValue);
  if (Number.isNaN(date.getTime())) {
    return normalizedValue;
  }

  const formatter = new Intl.DateTimeFormat('zh-CN', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });

  const parts = formatter.formatToParts(date).reduce((result, part) => {
    if (part.type !== 'literal') {
      result[part.type] = part.value;
    }
    return result;
  }, {});

  return `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}:${parts.second}`;
}
