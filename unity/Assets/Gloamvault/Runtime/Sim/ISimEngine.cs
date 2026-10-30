using System;

namespace Gloamvault.Sim
{
    /// <summary>
    /// The rules engine as the app sees it (D-139): the calls of <c>sim/src/bridge.ts</c>, strings in and out, a delve
    /// behind an integer handle. <see cref="JintSim"/> runs the TypeScript sim inside Jint; a fallback engine (PuerTS,
    /// or a C# port) would implement the same calls.
    /// </summary>
    public interface ISimEngine : IDisposable
    {
        /// <summary>The engine's name and version, for the log and the screen.</summary>
        string Name { get; }

        /// <summary>How long the engine took to load the script, run it, and index the content.</summary>
        StartupTiming Startup { get; }

        /// <summary>Indexes the content (the raw files as one JSON array); returns the counts as JSON.</summary>
        string Init(string contentJson);

        /// <summary>Starts a delve from a bridge <c>DelveRequest</c>; returns its handle.</summary>
        int CreateDelve(string requestJson);

        /// <summary>Plays one command; returns <c>{phase, commands, over}</c>.</summary>
        string Step(int handle, string commandJson);

        string Legal(int handle);
        string Hash(int handle);
        string Summary(int handle);
        string Phase(int handle);
        string LogSince(int handle, int from);
        void DisposeDelve(int handle);
    }

    /// <summary>Milliseconds spent getting the rules ready: the script read, the script run, the content indexed.</summary>
    [Serializable]
    public struct StartupTiming
    {
        public double loadMs;
        public double runMs;
        public double initMs;
        public double TotalMs => loadMs + runMs + initMs;
    }

    /// <summary>A call the sim refused (bad input, a rule's own throw) or an engine failure, with the sim's message.</summary>
    public sealed class SimException : Exception
    {
        public SimException(string message) : base(message) { }
        public SimException(string message, Exception inner) : base(message, inner) { }
    }
}
