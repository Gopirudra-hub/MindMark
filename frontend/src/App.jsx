import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Bookmarks from './pages/Bookmarks';
import BookmarkDetail from './pages/BookmarkDetail';
import Categories from './pages/Categories';
import DailyReview from './pages/DailyReview';
import Quiz from './pages/Quiz';
import Analytics from './pages/Analytics';

function App() {
  return (
    <Router>
      <Layout>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/bookmarks" element={<Bookmarks />} />
          <Route path="/bookmarks/:id" element={<BookmarkDetail />} />
          <Route path="/categories" element={<Categories />} />
          <Route path="/daily-review" element={<DailyReview />} />
          <Route path="/quiz/:bookmarkId" element={<Quiz />} />
          <Route path="/analytics" element={<Analytics />} />
        </Routes>
      </Layout>
    </Router>
  );
}

export default App;
