import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { CreateChama } from './components/CreateChama';
import { ViewChama } from './components/ViewChama';
import './App.css';

function App() {
  return (
    <div className="app">
      <header>
        <h1>Solana Chama</h1>
        <WalletMultiButton />
      </header>
      
      <main>
        <div className="container">
          <CreateChama />
          <ViewChama />
        </div>
      </main>
    </div>
  );
}

export default App;
