export function randomizeElements<T>(arr: T[]) {
    let result = [...arr].sort(() => 0.5 - Math.random() );
    result = result.slice(0, 150);
    result = result.sort(() => 0.5 - Math.random() );
    result = result.sort(() => 0.5 - Math.random() );
    return result;
}