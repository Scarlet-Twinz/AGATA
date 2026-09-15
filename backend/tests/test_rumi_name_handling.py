import asyncio

from app.services.rumi import stream_rumi


def test_standalone_name_is_not_rewritten_by_model() -> None:
    async def collect() -> str:
        chunks: list[str] = []
        async for chunk in stream_rumi([
            {"role": "system", "content": "You are Rumi."},
            {"role": "user", "content": "EMMANUELLA"},
        ]):
            chunks.append(chunk)
        return "".join(chunks)

    assert asyncio.run(collect()) == "Got it — I'll call you EMMANUELLA."
