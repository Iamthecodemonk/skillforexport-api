export const formatDateForSql = (value) => {
  if (!value) return null;
  try {
    const d = (value instanceof Date) ? value : new Date(value);
    if (Number.isNaN(d.getTime())) return null;
    return d.toISOString().slice(0, 10); // YYYY-MM-DD for DATE columns
  } catch (e) {
    return null;
  }
};

export default { formatDateForSql };
