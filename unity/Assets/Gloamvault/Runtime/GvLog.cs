using System.Globalization;
using System.Text;
using UnityEngine;

namespace Gloamvault
{
    /// <summary>
    /// One-line JSON records in the phone log, tagged <c>[gv]</c>, so Claude Code reads the phone's numbers over USB
    /// (<c>npm run unity:log</c>; 10-TECH-PLAN §7). <c>[gv] {"k":"perf","fps":60,...}</c>.
    /// </summary>
    public static class GvLog
    {
        public static void Line(string kind, params (string key, object value)[] fields)
        {
            Debug.Log(Format(kind, fields));
        }

        public static string Format(string kind, params (string key, object value)[] fields)
        {
            var sb = new StringBuilder("[gv] {\"k\":");
            AppendValue(sb, kind);
            foreach (var (key, value) in fields)
            {
                sb.Append(',');
                AppendValue(sb, key);
                sb.Append(':');
                AppendValue(sb, value);
            }
            return sb.Append('}').ToString();
        }

        static void AppendValue(StringBuilder sb, object value)
        {
            switch (value)
            {
                case null:
                    sb.Append("null");
                    break;
                case bool b:
                    sb.Append(b ? "true" : "false");
                    break;
                case int or long or uint:
                    sb.Append(System.Convert.ToString(value, CultureInfo.InvariantCulture));
                    break;
                case float f:
                    sb.Append(float.IsFinite(f) ? f.ToString("0.##", CultureInfo.InvariantCulture) : "null");
                    break;
                case double d:
                    sb.Append(double.IsFinite(d) ? d.ToString("0.##", CultureInfo.InvariantCulture) : "null");
                    break;
                default:
                    sb.Append('"');
                    foreach (var c in value.ToString())
                    {
                        if (c == '"' || c == '\\') sb.Append('\\').Append(c);
                        else if (c < ' ') sb.Append("\\u").Append(((int)c).ToString("x4"));
                        else sb.Append(c);
                    }
                    sb.Append('"');
                    break;
            }
        }
    }
}
